/*
  # book_consultation — server-side atomic booking RPC

  Single entry point for ALL consultation bookings. Three call sites in the
  app must route through this function:
    - LegalAdminPortal BookConsultModal (admin walk-in / scheduled booking)
    - LegalAdminPortal ScheduleConsultModal (admin scheduling for a known lead)
    - ScheduleCall.tsx (client-side self-booking)

  Atomicity: takes an exclusive row lock on staff_availability for the target
  (staff_id, day_of_week) for the duration of the transaction. Two concurrent
  callers attempting the same slot for the same staffer will serialize; the
  loser re-runs collision check #9 and rejects with slot_collision_or_min_gap.

  Timezone: ONE firm tz everywhere — America/Los_Angeles. All date /
  day_of_week / time-of-day extraction converts via AT TIME ZONE. Do NOT mix
  with UTC or server-local.

  Rejection contract: every reject returns
    { ok: false, event_id: null, staff_id: <uuid|null>, reason: '<machine_key — human_msg>' }
  Success:
    { ok: true,  event_id: <uuid>, staff_id: <uuid>, reason: null }

  Past-time bookings are rejected unless p_force_past = true.
*/

CREATE OR REPLACE FUNCTION book_consultation(
  p_staff_id          uuid,
  p_lead_id           uuid,
  p_start_time        timestamptz,
  p_end_time          timestamptz,
  p_client_name       text,
  p_client_phone      text DEFAULT NULL,
  p_client_email      text DEFAULT NULL,
  p_title             text DEFAULT NULL,
  p_event_subtype     text DEFAULT 'consultation',
  p_calendar_type     text DEFAULT 'intake',
  p_department        text DEFAULT 'intake',
  p_notes             text DEFAULT NULL,
  p_created_by        text DEFAULT NULL,
  p_is_walk_in        boolean DEFAULT false,
  p_force_past        boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_firm_tz constant text := 'America/Los_Angeles';
  v_staff_id     uuid;
  v_event_id     uuid;
  v_local_start  timestamp;
  v_local_end    timestamp;
  v_local_date   date;
  v_local_dow    int;
  v_avail        staff_availability%ROWTYPE;
  v_existing     int;
  v_min_gap      interval;
BEGIN
  -- 1. INPUT VALIDATION ------------------------------------------------------
  IF p_start_time IS NULL OR p_end_time IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'event_id', null, 'staff_id', null,
      'reason', 'invalid_input — start_time/end_time required');
  END IF;

  IF p_end_time <= p_start_time THEN
    RETURN jsonb_build_object('ok', false, 'event_id', null, 'staff_id', null,
      'reason', 'invalid_input — end_time must be after start_time');
  END IF;

  IF (p_end_time - p_start_time) < interval '5 minutes'
     OR (p_end_time - p_start_time) > interval '4 hours' THEN
    RETURN jsonb_build_object('ok', false, 'event_id', null, 'staff_id', null,
      'reason', 'invalid_input — duration must be 5min–4h');
  END IF;

  IF NOT p_force_past AND p_start_time < (now() - interval '1 minute') THEN
    RETURN jsonb_build_object('ok', false, 'event_id', null, 'staff_id', null,
      'reason', 'invalid_input — start_time in the past');
  END IF;

  IF coalesce(trim(p_client_name), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'event_id', null, 'staff_id', null,
      'reason', 'invalid_input — client_name required');
  END IF;

  IF p_lead_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM intake_leads WHERE id = p_lead_id) THEN
    RETURN jsonb_build_object('ok', false, 'event_id', null, 'staff_id', null,
      'reason', 'invalid_input — lead_id not found');
  END IF;

  IF p_staff_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM staff_members WHERE id = p_staff_id AND is_active = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'event_id', null, 'staff_id', null,
      'reason', 'invalid_input — staff_id not active');
  END IF;

  -- Firm-local extraction
  v_local_start := p_start_time AT TIME ZONE v_firm_tz;
  v_local_end   := p_end_time   AT TIME ZONE v_firm_tz;
  v_local_date  := v_local_start::date;
  v_local_dow   := EXTRACT(DOW FROM v_local_start)::int;

  -- 2. STAFFER SELECTION (least-loaded; staff_id tiebreak) -------------------
  IF p_staff_id IS NOT NULL THEN
    v_staff_id := p_staff_id;
  ELSE
    SELECT sa.staff_id INTO v_staff_id
    FROM staff_availability sa
    JOIN staff_members sm ON sm.id = sa.staff_id
    WHERE sm.is_active = true
      AND sa.day_of_week = v_local_dow
      AND sa.is_available = true
      AND v_local_start::time >= sa.start_time
      AND v_local_end::time   <= sa.end_time
      AND NOT EXISTS (
        SELECT 1 FROM intake_staff_time_off t
        WHERE t.staff_id = sa.staff_id AND t.date = v_local_date AND t.approved = true
      )
      AND NOT EXISTS (
        SELECT 1 FROM staff_sick_overrides s
        WHERE s.staff_id = sa.staff_id AND s.date = v_local_date AND s.is_active = true
      )
    ORDER BY (
      SELECT count(*) FROM calendar_events ce
      WHERE ce.staff_id = sa.staff_id
        AND ce.event_subtype = 'consultation'
        AND ce.status NOT IN ('cancelled','no_show','rescheduled')
        AND (ce.start_time AT TIME ZONE v_firm_tz)::date = v_local_date
    ) ASC,
    sa.staff_id ASC
    LIMIT 1;

    IF v_staff_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'event_id', null, 'staff_id', null,
        'reason', 'no_available_staff — no staffer with capacity at the requested time');
    END IF;
  END IF;

  -- 3. ATOMIC LOCK on staff_availability for (staff,weekday) -----------------
  SELECT * INTO v_avail
  FROM staff_availability
  WHERE staff_id = v_staff_id AND day_of_week = v_local_dow
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'event_id', null, 'staff_id', v_staff_id,
      'reason', 'no_availability_config_for_weekday');
  END IF;

  IF v_avail.is_available = false THEN
    RETURN jsonb_build_object('ok', false, 'event_id', null, 'staff_id', v_staff_id,
      'reason', 'staffer_not_available_this_weekday');
  END IF;

  -- 4. WORKING HOURS ---------------------------------------------------------
  IF v_local_start::time < v_avail.start_time OR v_local_end::time > v_avail.end_time THEN
    RETURN jsonb_build_object('ok', false, 'event_id', null, 'staff_id', v_staff_id,
      'reason', format('outside_working_hours — %s working %s–%s',
        v_staff_id, v_avail.start_time::text, v_avail.end_time::text));
  END IF;

  -- 5. LUNCH WINDOW ----------------------------------------------------------
  IF v_avail.lunch_start IS NOT NULL AND v_avail.lunch_end IS NOT NULL
     AND v_avail.lunch_start <> v_avail.lunch_end
     AND (v_local_start::time, v_local_end::time) OVERLAPS (v_avail.lunch_start, v_avail.lunch_end)
  THEN
    RETURN jsonb_build_object('ok', false, 'event_id', null, 'staff_id', v_staff_id,
      'reason', format('overlaps_lunch — lunch %s–%s',
        v_avail.lunch_start::text, v_avail.lunch_end::text));
  END IF;

  -- 6. TIME-OFF (full-day or approved partial overlap) -----------------------
  IF EXISTS (
    SELECT 1 FROM intake_staff_time_off t
    WHERE t.staff_id = v_staff_id
      AND t.date     = v_local_date
      AND t.approved = true
      AND (
        t.time_off_type = 'full_day'
        OR (
          t.time_off_type IN ('morning','afternoon','custom')
          AND (v_local_start::time, v_local_end::time)
              OVERLAPS (COALESCE(t.start_time,'00:00'::time), COALESCE(t.end_time,'23:59:59'::time))
        )
      )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'event_id', null, 'staff_id', v_staff_id,
      'reason', 'staffer_on_time_off');
  END IF;

  -- 7. SICK DAY --------------------------------------------------------------
  IF EXISTS (
    SELECT 1 FROM staff_sick_overrides s
    WHERE s.staff_id = v_staff_id AND s.date = v_local_date AND s.is_active = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'event_id', null, 'staff_id', v_staff_id,
      'reason', 'staffer_out_sick');
  END IF;

  -- 8. DAILY CAPACITY --------------------------------------------------------
  SELECT count(*) INTO v_existing
  FROM calendar_events ce
  WHERE ce.staff_id      = v_staff_id
    AND ce.event_subtype = 'consultation'
    AND ce.status NOT IN ('cancelled','no_show','rescheduled')
    AND (ce.start_time AT TIME ZONE v_firm_tz)::date = v_local_date;

  IF v_existing >= COALESCE(v_avail.max_consultations_per_day, 8) THEN
    RETURN jsonb_build_object('ok', false, 'event_id', null, 'staff_id', v_staff_id,
      'reason', format('daily_capacity_reached — %s of %s consults already booked today',
        v_existing, COALESCE(v_avail.max_consultations_per_day, 8)));
  END IF;

  -- 9. SLOT COLLISION + MIN GAP ----------------------------------------------
  v_min_gap := (COALESCE(v_avail.min_gap_between_appts_min, 15) || ' minutes')::interval;
  IF EXISTS (
    SELECT 1 FROM calendar_events ce
    WHERE ce.staff_id = v_staff_id
      AND ce.status NOT IN ('cancelled','no_show','rescheduled')
      AND (ce.start_time, ce.end_time)
          OVERLAPS (p_start_time - v_min_gap, p_end_time + v_min_gap)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'event_id', null, 'staff_id', v_staff_id,
      'reason', format('slot_collision_or_min_gap — must leave %smin between consults',
        COALESCE(v_avail.min_gap_between_appts_min, 15)));
  END IF;

  -- 10. INSERT --------------------------------------------------------------
  INSERT INTO calendar_events (
    calendar_type, event_subtype, department, title, start_time, end_time,
    staff_id, lead_id, client_name, client_phone, client_email,
    is_walk_in, cal_notes, status, created_by, created_at, updated_at
  ) VALUES (
    p_calendar_type, p_event_subtype, p_department,
    COALESCE(p_title, 'Consultation — ' || p_client_name),
    p_start_time, p_end_time,
    v_staff_id, p_lead_id, p_client_name, p_client_phone, p_client_email,
    p_is_walk_in, p_notes, 'scheduled', p_created_by, now(), now()
  )
  RETURNING id INTO v_event_id;

  -- 11. ATOMIC LEAD LINK — same transaction so a successful INSERT never
  -- leaves the lead un-linked or in the wrong status. If this UPDATE raises,
  -- the entire booking is rolled back along with it.
  IF p_lead_id IS NOT NULL THEN
    UPDATE intake_leads
    SET consultation_event_id = v_event_id,
        consultation_date     = p_start_time,
        status                = 'consultation_scheduled',
        last_contact_at       = now(),
        updated_at            = now()
    WHERE id = p_lead_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'event_id', v_event_id, 'staff_id', v_staff_id, 'reason', null);
END;
$$;

GRANT EXECUTE ON FUNCTION book_consultation(
  uuid, uuid, timestamptz, timestamptz, text, text, text, text, text, text, text, text, text, boolean, boolean
) TO anon, authenticated, service_role;

COMMENT ON FUNCTION book_consultation IS
  'Atomic consultation booking. Honors staff_availability (is_available, working hours, lunch, max_consultations_per_day, min_gap_between_appts_min), intake_staff_time_off (full/partial approved), and staff_sick_overrides. Firm tz: America/Los_Angeles. See migration 20260605130000.';
