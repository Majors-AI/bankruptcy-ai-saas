/*
  # Seed Real Trustees — AZ, WA (E & W), N. TX

  Seeds verified trustees from the US Trustee Program website and district court
  trustee pages. Data confirmed May 2026.

  - Arizona: 13 Ch.7 panel trustees + 3 Ch.13 standing trustees
  - Eastern Washington: 3 Ch.7 panel trustees + 1 Ch.13 standing trustee
  - Western Washington: 9 Ch.7 panel trustees + 2 Ch.13 standing trustees
  - Northern Texas: 13 Ch.7 panel trustees + 4 Ch.13 standing trustees
*/

DO $$
DECLARE
  az_id  uuid := 'ac9ffc0a-f7e7-4c3a-a837-84dbd9b2ce5a';
  wa_id  uuid := '36ce7afa-4a25-414f-bcba-04fedfe6ca70';
  tx_id  uuid := '346d4b98-941f-418c-9e1a-0de9ea8a3584';
  ch7_id uuid := '37eaf11a-180e-44c3-b594-7c495a7b499b';
  ch13_id uuid := '99e53195-afe5-48e3-b35b-886c79c8654e';
  t_id   uuid;
BEGIN

  /* ── ARIZONA Ch.7 ── */
  INSERT INTO trustees (state_id, chapter_type_id, name, district, email, phone, active)
  VALUES
    (az_id, ch7_id, 'David A. Birdsell',   'District of Arizona', 'dabtrustee@hotmail.com',      '(480) 644-1080', true),
    (az_id, ch7_id, 'Lothar H. Goernitz',  'District of Arizona', 'lgoernitztrustee@gmail.com',  '(602) 263-5413', true),
    (az_id, ch7_id, 'Eric M. Haley',       'District of Arizona', 'trustee@haley-law.com',        '(602) 218-5136', true),
    (az_id, ch7_id, 'Scott Hyder',         'District of Arizona', 'trusteehyder@scotthyderlaw.com','(480) 331-6107', true),
    (az_id, ch7_id, 'Stanley J. Kartchner','District of Arizona', 'trustee@aztrustee.com',        '(520) 742-1210', true),
    (az_id, ch7_id, 'Robert A. MacKenzie', 'District of Arizona', 'ram@ramlawltd.com',            '(602) 229-8575', true),
    (az_id, ch7_id, 'Dawn Maguire',        'District of Arizona', 'TrusteeMaguire@MaguireLawAZ.com','(480) 207-1987', true),
    (az_id, ch7_id, 'Anthony H. Mason',    'District of Arizona', 'ecfmason@earthlink.net',       '(602) 808-7770', true),
    (az_id, ch7_id, 'Brian J. Mullen',     'District of Arizona', 'bmullen@bktrustee.phxcoxmail.com','(602) 283-4468', true),
    (az_id, ch7_id, 'David M. Reaves',     'District of Arizona', 'trustee@reaves-law.com',       '(602) 241-0101', true),
    (az_id, ch7_id, 'Jim D. Smith',        'District of Arizona', 'jimsmith5@earthlink.net',      '(928) 783-7809', true),
    (az_id, ch7_id, 'Lawrence J. Warfield','District of Arizona', 'Lwarfield@trusteebk.com',      '(480) 948-1711', true),
    (az_id, ch7_id, 'Misty Weigle',        'District of Arizona', 'trustee@weiglelawfirm.com',    '(480) 571-3178', true);

  /* ── ARIZONA Ch.13 ── */
  INSERT INTO trustees (state_id, chapter_type_id, name, district, email, phone, notes, active)
  VALUES
    (az_id, ch13_id, 'Russell A. Brown', 'District of Arizona — Phoenix',
      'mail@ch13bk.com', '(602) 277-8996',
      '3838 N. Central Avenue #800, Phoenix, AZ 85012', true),
    (az_id, ch13_id, 'Dianne C. Kerns', 'District of Arizona — Tucson',
      'mail@dcktrustee.com', '(520) 544-9094',
      '31 North 6th Avenue, Suite 105-152, Tucson, AZ 85701', true),
    (az_id, ch13_id, 'Edward J. Maney', 'District of Arizona — Phoenix',
      'ejm@maney13trustee.com', '(602) 277-3776',
      '101 North First Avenue, Suite 1775, Phoenix, AZ 85003', true);

  /* ── EASTERN WASHINGTON Ch.7 ── */
  INSERT INTO trustees (state_id, chapter_type_id, name, district, phone, active)
  VALUES
    (wa_id, ch7_id, 'Matthew Anderton', 'Eastern District of Washington', '(509) 469-6648', true),
    (wa_id, ch7_id, 'John D. Munding',  'Eastern District of Washington', '(509) 590-3849', true),
    (wa_id, ch7_id, 'Kevin O''Rourke',  'Eastern District of Washington', '(509) 624-0159', true);

  /* ── EASTERN WASHINGTON Ch.13 ── */
  INSERT INTO trustees (state_id, chapter_type_id, name, district, email, phone, notes, active)
  VALUES
    (wa_id, ch13_id, 'Mike I. Todd', 'Eastern District of Washington',
      'mike.todd@spokane13.org', '(509) 747-8481',
      'P.O. Box 1513, Spokane, WA 99210', true);

  /* ── WESTERN WASHINGTON Ch.7 ── */
  INSERT INTO trustees (state_id, chapter_type_id, name, district, email, phone, active)
  VALUES
    (wa_id, ch7_id, 'Ronald G. Brown',          'Western District of Washington', 'rgbrownlaw@outlook.com',          '(425) 522-3649', true),
    (wa_id, ch7_id, 'Virginia Andrews Burdette', 'Western District of Washington', 'vab@andrewsburdette.com',         '(206) 441-0203', true),
    (wa_id, ch7_id, 'Kathryn A. Ellis',          'Western District of Washington', 'kae@seanet.com',                  '(206) 682-5002', true),
    (wa_id, ch7_id, 'Russell D. Garrett',        'Western District of Washington', 'russ.garrett@jordanramis.com',   '(360) 567-3918', true),
    (wa_id, ch7_id, 'Michael P. Klein',          'Western District of Washington', 'trusteeklein@hotmail.com',        '(206) 842-3638', true),
    (wa_id, ch7_id, 'Darren R. Krattli',         'Western District of Washington', 'dkrattli@eisenhowerlaw.com',      '(253) 319-0955', true),
    (wa_id, ch7_id, 'Kathleen V. Shoemaker',     'Western District of Washington', 'ks@shoemakertrustee.com',         '(206) 666-3947', true),
    (wa_id, ch7_id, 'Mark D. Waldron',           'Western District of Washington', 'trustee@mwaldronlaw.com',         '(253) 565-5800', true),
    (wa_id, ch7_id, 'Edmund J. Wood',            'Western District of Washington', 'ewood1@aol.com',                  '(206) 623-4382', true);

  /* ── WESTERN WASHINGTON Ch.13 ── */
  INSERT INTO trustees (state_id, chapter_type_id, name, district, email, phone, notes, active)
  VALUES
    (wa_id, ch13_id, 'Jason Wilson-Aguilar', 'Western District of Washington — Seattle',
      'courtmail@seattlech13.com', '(206) 624-5124',
      '600 University Street, Suite 1300, Seattle, WA 98101', true),
    (wa_id, ch13_id, 'Michael G. Malaier', 'Western District of Washington — Tacoma',
      'info@chapter13tacoma.org', '(253) 572-6600',
      '5219 North Shirley Street, Suite 101, Ruston, WA 98407', true);

  /* ── NORTHERN TEXAS Ch.7 ── */
  INSERT INTO trustees (state_id, chapter_type_id, name, district, email, phone, active)
  VALUES
    (tx_id, ch7_id, 'Shawn K. Brown',      'Northern District of Texas', 'shawn@browntrustee.com',     '(817) 488-6023', true),
    (tx_id, ch7_id, 'Anne E. Burns',       'Northern District of Texas', 'aburns@chfirm.com',           '(214) 573-7343', true),
    (tx_id, ch7_id, 'Marilyn D. Garner',   'Northern District of Texas', 'mgarner@marilyndgarner.com',  '(817) 505-1499', true),
    (tx_id, ch7_id, 'Areya Holder Aurzada','Northern District of Texas', 'areya@holderlawpc.com',       '(972) 438-8800', true),
    (tx_id, ch7_id, 'Myrtle L. McDonald',  'Northern District of Texas', 'Myrtlemcdonald1@gmail.com',   '(806) 792-0056', true),
    (tx_id, ch7_id, 'Roddrick Newhouse',   'Northern District of Texas', 'Rn7trustee@gmail.com',        '(469) 777-6560', true),
    (tx_id, ch7_id, 'Laurie Dahl Rea',     'Northern District of Texas', 'Laurie.Rea@romclaw.com',       '(817) 347-5267', true),
    (tx_id, ch7_id, 'Kent D. Ries',        'Northern District of Texas', 'kent@kentries.com',            '(806) 242-7437', true),
    (tx_id, ch7_id, 'Scott M. Seidel',     'Northern District of Texas', 'scott@scottseidel.com',        '(214) 234-2503', true),
    (tx_id, ch7_id, 'Daniel J. Sherman',   'Northern District of Texas', 'corky@syllp.com',              '(214) 942-5502', true),
    (tx_id, ch7_id, 'John D. Spicer',      'Northern District of Texas', 'jdspicer@chfirm.com',          '(214) 573-7331', true),
    (tx_id, ch7_id, 'Behrooz P. Vida',     'Northern District of Texas', 'Behrooz@vidalawfirm.com',      '(817) 358-9977', true),
    (tx_id, ch7_id, 'Robert Yaquinto, Jr.','Northern District of Texas', 'rob@syllp.com',                '(214) 942-5502', true);

  /* ── NORTHERN TEXAS Ch.13 ── */
  INSERT INTO trustees (state_id, chapter_type_id, name, district, email, phone, notes, active)
  VALUES
    (tx_id, ch13_id, 'Thomas D. Powers', 'Northern District of Texas — Dallas',
      'tpowers@dallasch13.com', '(214) 855-9200',
      '5601 Executive Dr., Suite 300, Irving, TX 75038', true),
    (tx_id, ch13_id, 'Tim Truman', 'Northern District of Texas — Fort Worth',
      'tntruman@aol.com', '(817) 770-8500',
      '6851 N.E. Loop 820, Suite 300, N. Richland Hills, TX 76180', true),
    (tx_id, ch13_id, 'Pamela A. Bassel', 'Northern District of Texas — Fort Worth',
      'basselcustomerservice@fwch13.com', '(817) 916-4710',
      '7001 Blvd 26, Suite 150, North Richland Hills, TX 76180', true),
    (tx_id, ch13_id, 'Katherine L. Davis', 'Northern District of Texas — W. Texas (Abilene/Amarillo/Lubbock)',
      null, '(806) 748-6699',
      '1407 Buddy Holly Avenue, Lubbock, TX 79401', true);

END $$;
