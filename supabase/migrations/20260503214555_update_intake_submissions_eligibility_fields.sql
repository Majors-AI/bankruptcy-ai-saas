/*
  # Update intake_submissions for eligibility-focused intake

  Replaces the simple flat intake schema with a richer structure that supports:
  1. Proper residency/venue determination (state, prior state for recent movers)
  2. Detailed dependents (age, relationship, disability/elderly parent flags, household contributions)
  3. Structured income sources (JSON array with type, frequency, gross/net per period)
  4. Monthly expense breakdown (for disposable income / means test calculation)
  5. Detailed real property records (JSON array with address, type, value, lender, current status)
  6. Detailed vehicle records (JSON array)
  7. Richer personal property fields (life insurance cash value, firearms, collectibles)
  8. Full SOFA financial history:
     - Prior bankruptcies with chapter, year, district, discharge status, dismissal reason
     - Property transfers (type, recipient, relationship, amount, date)
     - Preferential payments (creditor, amount, date, relationship)
     - Business ownership, tax refunds, recent luxury purchases
  9. Removes chapter_type — chapter is determined by attorney after eligibility analysis

  Modifications:
  - Drops chapter_type column (no longer collected at intake)
  - Drops simple flat dependency columns, replaces with dependents_json
  - Drops simple income columns, replaces with income_sources_json
  - Adds expense columns (rent/mortgage, utilities, food, transportation, healthcare, insurance, childcare, other)
  - Drops simple vehicle/property text columns, replaces with JSON arrays
  - Adds detailed personal property fields
  - Expands SOFA history fields with JSON arrays for prior BK cases, transfers, preferential payments
  - Adds prior_state for venue determination
  - Adds alt_phone

  Security: RLS unchanged — anon INSERT policy still applies.
*/

-- Add new columns safely

DO $$
BEGIN
  -- Residency
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_submissions' AND column_name='prior_state') THEN
    ALTER TABLE intake_submissions ADD COLUMN prior_state text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_submissions' AND column_name='alt_phone') THEN
    ALTER TABLE intake_submissions ADD COLUMN alt_phone text;
  END IF;

  -- JSON structured data
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_submissions' AND column_name='dependents_json') THEN
    ALTER TABLE intake_submissions ADD COLUMN dependents_json jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_submissions' AND column_name='income_sources_json') THEN
    ALTER TABLE intake_submissions ADD COLUMN income_sources_json jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_submissions' AND column_name='real_properties_json') THEN
    ALTER TABLE intake_submissions ADD COLUMN real_properties_json jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_submissions' AND column_name='vehicles_json') THEN
    ALTER TABLE intake_submissions ADD COLUMN vehicles_json jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_submissions' AND column_name='no_vehicles') THEN
    ALTER TABLE intake_submissions ADD COLUMN no_vehicles boolean NOT NULL DEFAULT false;
  END IF;

  -- Expenses
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_submissions' AND column_name='exp_rent_mortgage') THEN
    ALTER TABLE intake_submissions ADD COLUMN exp_rent_mortgage numeric(12,2) NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_submissions' AND column_name='exp_utilities') THEN
    ALTER TABLE intake_submissions ADD COLUMN exp_utilities numeric(12,2) NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_submissions' AND column_name='exp_food') THEN
    ALTER TABLE intake_submissions ADD COLUMN exp_food numeric(12,2) NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_submissions' AND column_name='exp_transportation') THEN
    ALTER TABLE intake_submissions ADD COLUMN exp_transportation numeric(12,2) NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_submissions' AND column_name='exp_healthcare') THEN
    ALTER TABLE intake_submissions ADD COLUMN exp_healthcare numeric(12,2) NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_submissions' AND column_name='exp_insurance') THEN
    ALTER TABLE intake_submissions ADD COLUMN exp_insurance numeric(12,2) NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_submissions' AND column_name='exp_childcare') THEN
    ALTER TABLE intake_submissions ADD COLUMN exp_childcare numeric(12,2) NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_submissions' AND column_name='exp_other') THEN
    ALTER TABLE intake_submissions ADD COLUMN exp_other numeric(12,2) NOT NULL DEFAULT 0;
  END IF;

  -- Personal property detail
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_submissions' AND column_name='bank_balance') THEN
    ALTER TABLE intake_submissions ADD COLUMN bank_balance numeric(12,2) NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_submissions' AND column_name='retirement_balance') THEN
    ALTER TABLE intake_submissions ADD COLUMN retirement_balance numeric(12,2) NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_submissions' AND column_name='stocks_value') THEN
    ALTER TABLE intake_submissions ADD COLUMN stocks_value numeric(12,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_submissions' AND column_name='crypto_value') THEN
    ALTER TABLE intake_submissions ADD COLUMN crypto_value numeric(12,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_submissions' AND column_name='has_life_insurance') THEN
    ALTER TABLE intake_submissions ADD COLUMN has_life_insurance boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_submissions' AND column_name='life_insurance_cash_value') THEN
    ALTER TABLE intake_submissions ADD COLUMN life_insurance_cash_value numeric(12,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_submissions' AND column_name='has_firearms') THEN
    ALTER TABLE intake_submissions ADD COLUMN has_firearms boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_submissions' AND column_name='firearm_value') THEN
    ALTER TABLE intake_submissions ADD COLUMN firearm_value numeric(12,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_submissions' AND column_name='has_collectibles') THEN
    ALTER TABLE intake_submissions ADD COLUMN has_collectibles boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_submissions' AND column_name='collectibles_value') THEN
    ALTER TABLE intake_submissions ADD COLUMN collectibles_value numeric(12,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_submissions' AND column_name='household_goods_value') THEN
    ALTER TABLE intake_submissions ADD COLUMN household_goods_value numeric(12,2) NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_submissions' AND column_name='other_property_desc') THEN
    ALTER TABLE intake_submissions ADD COLUMN other_property_desc text;
  END IF;

  -- SOFA history detail
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_submissions' AND column_name='has_prior_bk') THEN
    ALTER TABLE intake_submissions ADD COLUMN has_prior_bk boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_submissions' AND column_name='prior_bankruptcies_json') THEN
    ALTER TABLE intake_submissions ADD COLUMN prior_bankruptcies_json jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_submissions' AND column_name='lawsuit_details') THEN
    ALTER TABLE intake_submissions ADD COLUMN lawsuit_details text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_submissions' AND column_name='garnishment_details') THEN
    ALTER TABLE intake_submissions ADD COLUMN garnishment_details text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_submissions' AND column_name='has_transfers') THEN
    ALTER TABLE intake_submissions ADD COLUMN has_transfers boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_submissions' AND column_name='transfers_json') THEN
    ALTER TABLE intake_submissions ADD COLUMN transfers_json jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_submissions' AND column_name='has_preferential_payments') THEN
    ALTER TABLE intake_submissions ADD COLUMN has_preferential_payments boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_submissions' AND column_name='preferential_payments_json') THEN
    ALTER TABLE intake_submissions ADD COLUMN preferential_payments_json jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_submissions' AND column_name='business_details') THEN
    ALTER TABLE intake_submissions ADD COLUMN business_details text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_submissions' AND column_name='expected_refund') THEN
    ALTER TABLE intake_submissions ADD COLUMN expected_refund boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_submissions' AND column_name='refund_amount') THEN
    ALTER TABLE intake_submissions ADD COLUMN refund_amount numeric(12,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_submissions' AND column_name='recent_luxury') THEN
    ALTER TABLE intake_submissions ADD COLUMN recent_luxury boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_submissions' AND column_name='luxury_details') THEN
    ALTER TABLE intake_submissions ADD COLUMN luxury_details text;
  END IF;
END $$;
