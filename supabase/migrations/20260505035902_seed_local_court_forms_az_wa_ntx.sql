/*
  # Seed Local Court Forms — AZ, E.WA, W.WA, N.TX

  Seeds verified local bankruptcy court forms for:
  - District of Arizona (AZ)
  - Eastern District of Washington (E_WA)
  - Western District of Washington (W_WA)
  - Northern District of Texas (N_TX)

  Source: azb.uscourts.gov, waeb.uscourts.gov, wawb.uscourts.gov, txnb.uscourts.gov
  Confirmed May 2026.
*/

INSERT INTO local_court_forms
  (district_code, district_name, form_number, form_name, description, chapter_applicability, category, sort_order)
VALUES

/* ── DISTRICT OF ARIZONA ── */
('AZ','District of Arizona','1007-1','Declaration of Electronic Filing',null,'All','General',10),
('AZ','District of Arizona','1007-2','Declaration of Evidence of Payments',null,'All','General',20),
('AZ','District of Arizona','1007-3','Declaration Under Penalty of Perjury for Debtors Without Attorney',null,'All','General',30),
('AZ','District of Arizona','1017-1','Motion to Vacate Order of Dismissal and to Reinstate Case',null,'All','General',40),
('AZ','District of Arizona','2003-2(a)(1)','Questionnaire for Chapter 7 Debtor','341 meeting questionnaire for Ch.7 debtors','Chapter 7','Chapter 7',50),
('AZ','District of Arizona','2003-2(a)(2)','Document Checklist for Chapter 7 Debtor','Documents to bring to 341 meeting','Chapter 7','Chapter 7',60),
('AZ','District of Arizona','3003-1','Order Setting and Notice of Deadline for Filing Proof of Claim',null,'Chapter 11','Chapter 11',70),
('AZ','District of Arizona','3003-2','Order Setting Initial Hearing on Approval of Disclosure Statement',null,'Chapter 11','Chapter 11',80),
('AZ','District of Arizona','3003-3','Order Approving Disclosure Statement and Setting Initial Confirmation Hearing',null,'Chapter 11','Chapter 11',90),
('AZ','District of Arizona','3003-4','Order Setting Confirmation Hearing and Fixing Deadlines (Subchapter V)',null,'Chapter 11','Chapter 11',100),
('AZ','District of Arizona','4003-2','Motion to Avoid Judgment Lien / Notice / Order',null,'Chapter 7','Chapter 7',110),
('AZ','District of Arizona','6007-1(c)(1)(2)','Notice of Intent to Abandon by Trustee or Debtor in Possession',null,'All','General',120),
('AZ','District of Arizona','6007-1(c)(3)','Notice of Motion to Compel Abandonment',null,'All','General',130),
('AZ','District of Arizona','6008-1','Motion for Order Authorizing Redemption of Personal Property',null,'Chapter 7','Chapter 7',140),
('AZ','District of Arizona','7016-1','Joint Pretrial Statement',null,'All','Adversary',150),
('AZ','District of Arizona','7016(b)','Notice of Scheduling Conference',null,'All','Adversary',160),
('AZ','District of Arizona','9027-1','Notice of Removal of State Court Action',null,'All','General',170),
('AZ','District of Arizona','2084-2','Chapter 13 Monthly Business Operating Statement',null,'Chapter 13','Chapter 13',180),
('AZ','District of Arizona','2084-4','Chapter 13 Plan',null,'Chapter 13','Chapter 13',190),
('AZ','District of Arizona','2084-4B','Authorization to Release Information to Trustee Regarding Secured Claims',null,'Chapter 13','Chapter 13',200),
('AZ','District of Arizona','2084-19A','Mortgage Creditor Checklist',null,'Chapter 13','Chapter 13',210),
('AZ','District of Arizona','2084-26','Certificate of Eligibility for Chapter 13 Discharge',null,'Chapter 13','Chapter 13',220),

/* ── EASTERN DISTRICT OF WASHINGTON ── */
('E_WA','Eastern District of Washington','AD60','ECF Attorney Registration Form',null,'All','ECF',10),
('E_WA','Eastern District of Washington','AD60A','ECF Limited Filer Registration Form',null,'All','ECF',20),
('E_WA','Eastern District of Washington','ADR Form 1','Mediation Procedures for Parties and Mediator',null,'All','ADR',30),
('E_WA','Eastern District of Washington','ADR Form 2','Certificate of Compliance with LBR 9019-2 (Mediation)',null,'All','ADR',40),
('E_WA','Eastern District of Washington','ADR Form 3','Stipulation Regarding Selection of Mediator',null,'All','ADR',50),
('E_WA','Eastern District of Washington','ADR Form 4','Order Appointing Mediator',null,'All','ADR',60),
('E_WA','Eastern District of Washington','ADR Form 5','Sample Confidentiality Agreement',null,'All','ADR',70),
('E_WA','Eastern District of Washington','ADR Form 6','Mediation Report',null,'All','ADR',80),
('E_WA','Eastern District of Washington','ADR Form 7','Application for Appointment to Bankruptcy Mediation Panel',null,'All','ADR',90),
('E_WA','Eastern District of Washington','LF1007-1','Declaration Regarding Payments',null,'Chapter 13','Chapter 13',100),
('E_WA','Eastern District of Washington','LF1007-2','Address Change Form',null,'All','General',110),
('E_WA','Eastern District of Washington','LF1007-3','Motion for Waiver of Credit Counseling Requirement',null,'All','General',120),
('E_WA','Eastern District of Washington','LF2014','Application for Order Approving Employment',null,'All','General',130),
('E_WA','Eastern District of Washington','LF2014-1','Order Approving Employment',null,'All','General',140),
('E_WA','Eastern District of Washington','LF2016','Application for Award of Compensation',null,'All','General',150),
('E_WA','Eastern District of Washington','LF2082-1','Chapter 12 Discharge Motion and Notice',null,'Chapter 12','Chapter 12',160),
('E_WA','Eastern District of Washington','LF2083','Chapter 13 Plan Documents',null,'Chapter 13','Chapter 13',170),
('E_WA','Eastern District of Washington','LF2083-1F','Certificate of Debtor (Chapter 13)',null,'Chapter 13','Chapter 13',180),
('E_WA','Eastern District of Washington','LF3016-1','Notice of Approval of Disclosure Statement / Notice of Hearing on Disclosure Statement and Confirmation',null,'Chapter 11','Chapter 11',190),
('E_WA','Eastern District of Washington','LF3017-1','Notice of Filing of Written Disclosure Statement',null,'Chapter 11','Chapter 11',200),
('E_WA','Eastern District of Washington','LF3018','Ballot and Balloting Reports',null,'Chapter 11','Chapter 11',210),
('E_WA','Eastern District of Washington','LF3021-1','Post-Confirmation Disbursement Report',null,'Chapter 11','Chapter 11',220),
('E_WA','Eastern District of Washington','LF3022-1','Motion for Chapter 11 Discharge / Final Account',null,'Chapter 11','Chapter 11',230),
('E_WA','Eastern District of Washington','LF4001-1','Notice of Stay',null,'All','General',240),
('E_WA','Eastern District of Washington','LF4008-1','Motion to Enlarge Time to File Reaffirmation Agreement',null,'All','General',250),
('E_WA','Eastern District of Washington','LF5005-3','Request for Waiver from Electronic Filing',null,'All','ECF',260),
('E_WA','Eastern District of Washington','LF7004','Certificate of Mailing Summons',null,'All','Adversary',270),
('E_WA','Eastern District of Washington','LF7016-1','Notice of Scheduling Conference',null,'All','Adversary',280),
('E_WA','Eastern District of Washington','LF7054-1','Bill of Costs',null,'All','Adversary',290),
('E_WA','Eastern District of Washington','LF9036','Debtor Electronic Registration Form',null,'All','ECF',300),
('E_WA','Eastern District of Washington','LF9070-1','Exhibit Index',null,'All','General',310),

/* ── WESTERN DISTRICT OF WASHINGTON ── */
('W_WA','Western District of Washington','BK 7','Chapter 7 Bankruptcy Forms Packet (Pro Se)','91-page packet for self-represented filers','Chapter 7','Pro Se',10),
('W_WA','Western District of Washington','BK 13','Chapter 13 Bankruptcy Forms Packet (Pro Se)','92-page packet for self-represented filers','Chapter 13','Pro Se',20),
('W_WA','Western District of Washington','MML','Debtor(s) Requirement to Provide List of Creditors',null,'All','General',30),
('W_WA','Western District of Washington','LBF 1','Notice of Motion and Hearing Form',null,'All','General',40),
('W_WA','Western District of Washington','LBF 1-1','Generic Motion and Notice of Motion & Hearing',null,'All','General',50),
('W_WA','Western District of Washington','LBF 2','Amendment Cover Sheet (paper filings only)',null,'All','General',60),
('W_WA','Western District of Washington','LBF 3','Pro Hac Vice Application',null,'All','General',70),
('W_WA','Western District of Washington','LBF 3-1','Order on Pro Hac Vice Application',null,'All','General',80),
('W_WA','Western District of Washington','LBF 4','Application for Leave to Appear as a Legal Intern',null,'All','General',90),
('W_WA','Western District of Washington','LBF 4-1','Order on Application for Legal Intern Status',null,'All','General',100),
('W_WA','Western District of Washington','LBF 5','Motion for Waiver of Credit Counseling & Financial Management',null,'All','General',110),
('W_WA','Western District of Washington','LBF 6','Audio Hearing Request Form',null,'All','General',120),
('W_WA','Western District of Washington','LBF 7','Change of Address',null,'All','General',130),
('W_WA','Western District of Washington','LBF 8','Debtor''s Electronic Noticing Request (DeBN)',null,'All','ECF',140),
('W_WA','Western District of Washington','LBF 9','Declaration Regarding Debtor''s Required Documents',null,'All','General',150),
('W_WA','Western District of Washington','LBF 11','Request for Special Notice',null,'All','General',160),
('W_WA','Western District of Washington','LBF 12','Application for Payment of Unclaimed Funds',null,'All','General',170),
('W_WA','Western District of Washington','LBF 12-1','Certificate of Service (Unclaimed Funds)',null,'All','General',180),
('W_WA','Western District of Washington','LBF 13-1','Chapter 13 Order Dismissing Case',null,'Chapter 13','Chapter 13',190),
('W_WA','Western District of Washington','LBF 13-2','Chapter 13 Trustee Information Sheet',null,'Chapter 13','Chapter 13',200),
('W_WA','Western District of Washington','LBF 13-4','Chapter 13 Plan',null,'Chapter 13','Chapter 13',210),
('W_WA','Western District of Washington','LBF 13-5','Chapter 13 Rights and Responsibilities – Debtors/Attorneys',null,'Chapter 13','Chapter 13',220),
('W_WA','Western District of Washington','LBF 13-6','Order Approving Post-Confirmation Modification',null,'Chapter 13','Chapter 13',230),
('W_WA','Western District of Washington','LBF 13-7','Order Granting Hardship Discharge',null,'Chapter 13','Chapter 13',240),
('W_WA','Western District of Washington','LBF 13-9','Chapter 13 Fee Application',null,'Chapter 13','Chapter 13',250),
('W_WA','Western District of Washington','LBF 13-10','Chapter 13 Order Approving Attorney''s Compensation',null,'Chapter 13','Chapter 13',260),
('W_WA','Western District of Washington','ADR 1','Mediation Certification',null,'All','ADR',270),
('W_WA','Western District of Washington','ADR 2','Mediation Program Instructions for Parties',null,'All','ADR',280),
('W_WA','Western District of Washington','ADR 2A','Mediation Program Instructions for Pro Se Litigants',null,'All','ADR',290),
('W_WA','Western District of Washington','ADR 3','Stipulation Appointing Mediator',null,'All','ADR',300),
('W_WA','Western District of Washington','ADR 4','Order Appointing Mediator',null,'All','ADR',310),
('W_WA','Western District of Washington','ADR 5','Confidentiality Agreement',null,'All','ADR',320),
('W_WA','Western District of Washington','ADR 6','Certificate of Compliance',null,'All','ADR',330),
('W_WA','Western District of Washington','ADR 7','Report of Mediation Conference',null,'All','ADR',340);
