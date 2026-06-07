/*
  # get_open_slots — read helper

  Returns the same slot decisions book_consultation would apply, so the UI
  shows exactly what the booking RPC will accept.

  Slot cadence: 1-hour anchored (9:00, 10:00, 11:00, …). Appointment duration
  defaults to 45 minutes; the 15-min gap between consults is enforced
  separately via min_gap_between_appts_min in book_consultation. Together this
  yields a clean hourly schedule per "every hour" spec.

  Returns: jsonb array of
    { staff_id, staff_name, slot_start, slot_end, available, reason }
  where reason ∈ {null, 'lunch', 'time_off', 'daily_capacity_reached', 'booked'}.
  Slots outside the staffer's working hours are omitted entirely (not returned
  as "outside_working_hours" rows) so the UI doesn't have to filter noise.

  Firm tz: America/Los_Angeles (same constant as book_consultation).
*/

CREATE OR REPLACE FUNCTION get_open_slots(
  p_staff_id      uuid,           -- NULL = all active staff
  p_date          date,           -- target date in firm tz
  p_slot_minutes  integer DEFAULT 45
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_firm_tz constant text := 'America/Los_Angeles';
  v_dow             int;
  v_result          jsonb := '[]'::jsonb;
  v_staff           record;
  v_avail           staff_availability%ROWTYPE;
  v_full_day_off    boolean;
  v_sick            boolean;
  v_existing        int;
  v_hour            int;
  v_slot_start_tz   timestamptz;
  v_slot_end_tz     timestamptz;
  v_slot_local_st   time;
  v_slot_local_et   time;
  v_reason          text;
BEGIN
  v_dow := EXTRACT(DOW FROM p_date)::int;

  FOR v_staff IN
    SELECT sm.id, sm.name
    FROM staff_members sm
    WHERE sm.is_active = true
      AND (p_staff_id IS NULL OR sm.id = p_staff_id)
    ORDER BY sm.name
  LOOP
    -- Availability for this staff × weekday
    SELECT * INTO v_avail
    FROM staff_availability
    WHERE staff_id = v_staff.id AND day_of_week = v_dow;

    IF NOT FOUND THEN CONTINUE; END IF;
    IF v_avail.is_available = false THEN CONTINUE; END IF;

    -- Full-day blockers — skip the staffer for the day entirely
    SELECT EXISTS (
      SELECT 1 FROM intake_staff_time_off t
      WHERE t.staff_id = v_staff.id
        AND t.date = p_date
        AND t.approved = true
        AND t.time_off_type = 'full_day'
    ) INTO v_full_day_off;
    IF v_full_day_off THEN CONTINUE; END IF;

    SELECT EXISTS (
      SELECT 1 FROM staff_sick_overrides s
      WHERE s.staff_id = v_staff.id AND s.date = p_date AND s.is_active = true
    ) INTO v_sick;
    IF v_sick THEN CONTINUE; END IF;

    -- Daily capacity check (used to flag remaining slots as full once reached)
    SELECT count(*) INTO v_existing
    FROM calendar_events ce
    WHERE ce.staff_id      = v_staff.id
      AND ce.event_subtype = 'consultation'
      AND ce.status NOT IN ('cancelled','no_show','rescheduled')
      AND (ce.start_time AT TIME ZONE v_firm_tz)::date = p_date;

    -- Walk every hour 0..23; emit slot rows for those that fit working hours
    FOR v_hour IN 0..23 LOOP
      v_slot_start_tz := (p_date::text || ' ' || lpad(v_hour::text, 2, '0') || ':00:00')::timestamp
                          AT TIME ZONE v_firm_tz;
      v_slot_end_tz   := v_slot_start_tz + (p_slot_minutes || ' minutes')::interval;
      v_slot_local_st := (v_slot_start_tz AT TIME ZONE v_firm_tz)::time;
      v_slot_local_et := (v_slot_end_tz   AT TIME ZONE v_firm_tz)::time;

      -- Only emit slots that fit inside working hours
      IF v_slot_local_st < v_avail.start_time OR v_slot_local_et > v_avail.end_time THEN
        CONTINUE;
      END IF;

      v_reason := NULL;

      -- Lunch overlap
      IF v_avail.lunch_start IS NOT NULL AND v_avail.lunch_end IS NOT NULL
         AND v_avail.lunch_start <> v_avail.lunch_end
         AND (v_slot_local_st, v_slot_local_et) OVERLAPS (v_avail.lunch_start, v_avail.lunch_end)
      THEN
        v_reason := 'lunch';
      -- Partial-day approved time-off overlap
      ELSIF EXISTS (
        SELECT 1 FROM intake_staff_time_off t
        WHERE t.staff_id = v_staff.id AND t.date = p_date AND t.approved = true
          AND t.time_off_type IN ('morning','afternoon','custom')
          AND (v_slot_local_st, v_slot_local_et)
              OVERLAPS (COALESCE(t.start_time,'00:00'::time), COALESCE(t.end_time,'23:59:59'::time))
      ) THEN
        v_reason := 'time_off';
      -- Daily capacity reached
      ELSIF v_existing >= COALESCE(v_avail.max_consultations_per_day, 8) THEN
        v_reason := 'daily_capacity_reached';
      -- Collision / min-gap with existing event
      ELSIF EXISTS (
        SELECT 1 FROM calendar_events ce
        WHERE ce.staff_id = v_staff.id
          AND ce.status NOT IN ('cancelled','no_show','rescheduled')
          AND (ce.start_time, ce.end_time) OVERLAPS
              (v_slot_start_tz - (COALESCE(v_avail.min_gap_between_appts_min, 15) || ' minutes')::interval,
               v_slot_end_tz   + (COALESCE(v_avail.min_gap_between_appts_min, 15) || ' minutes')::interval)
      ) THEN
        v_reason := 'booked';
      END IF;

      v_result := v_result || jsonb_build_object(
        'staff_id',   v_staff.id,
        'staff_name', v_staff.name,
        'slot_start', v_slot_start_tz,
        'slot_end',   v_slot_end_tz,
        'available',  v_reason IS NULL,
        'reason',     v_reason
      );
    END LOOP;
  END LOOP;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_open_slots(uuid, date, integer) TO anon, authenticated, service_role;

COMMENT ON FUNCTION get_open_slots IS
  'Returns hourly slot decisions for a given date — same rules as book_consultation, so the UI shows exactly what the booking RPC will accept. Firm tz: America/Los_Angeles.';
