# Think Tank / RADIANT — Compliance Certifications & Regulatory Standards Guide

**Version 1.0 | February 13, 2026**
**Prepared for RADIANT Platform & Think Tank Compliance Documentation**

> This document consolidates the current version, effective dates, governing bodies, and detailed requirements for eight major compliance certifications and regulatory standards applicable to the RADIANT platform and Think Tank operations as of February 2026. Each standard is covered with official names, version history, key provisions, requirements, enforcement mechanisms, and links to authoritative sources. The standards span data privacy (GDPR, DPF), healthcare (HIPAA, HDS), information security and audit (SOC 2, PCI DSS, ISO 27701), and artificial intelligence governance (ISO 42001).

---

## Table of Contents

- [Part I: Quick Reference — Standards by Category](#part-i-quick-reference--standards-by-category)
- [Part II: SOC 2 Type 2 — AICPA Trust Services Criteria](#part-ii-soc-2-type-2--aicpa-trust-services-criteria)
- [Part III: GDPR — General Data Protection Regulation](#part-iii-gdpr--general-data-protection-regulation)
- [Part IV: HIPAA — Health Insurance Portability and Accountability Act](#part-iv-hipaa--health-insurance-portability-and-accountability-act)
- [Part V: ISO 27701 — Privacy Information Management Systems](#part-v-iso-27701--privacy-information-management-systems)
- [Part VI: ISO 42001 — AI Management Systems](#part-vi-iso-42001--ai-management-systems)
- [Part VII: HDS — Health Data Hosting Certification](#part-vii-hds--health-data-hosting-certification)
- [Part VIII: Data Privacy Framework — EU-U.S., UK Extension, Swiss-U.S.](#part-viii-data-privacy-framework--eu-us-uk-extension-swiss-us)
- [Part IX: PCI DSS — Payment Card Industry Data Security Standard](#part-ix-pci-dss--payment-card-industry-data-security-standard)
- [Part X: Critical Compliance Timelines](#part-x-critical-compliance-timelines)
- [Part XI: Cross-Framework Trends & Analysis](#part-xi-cross-framework-trends--analysis)

---

## Part I: Quick Reference — Standards by Category

### Data Privacy & Protection

| Standard | Current Version | Key Dates |
|----------|----------------|-----------|
| **GDPR** — General Data Protection Regulation | Regulation (EU) 2016/679 | Enforced 25 May 2018. No substantive amendments enacted. Digital Omnibus proposal Nov 2025 (in trilogue). |
| **ISO 27701** — Privacy Information Management Systems | Edition 2, published 14 October 2025 | Standalone PIMS standard. Transition deadline: October 2028. |
| **Data Privacy Framework (DPF)** — EU-U.S., UK Extension, Swiss-U.S. | EU-U.S. effective 10 Jul 2023 | UK Extension 12 Oct 2023. Swiss-U.S. 15 Sep 2024. EU court upheld Sep 2025. |

### Healthcare

| Standard | Current Version | Key Dates |
|----------|----------------|-----------|
| **HIPAA** — Health Insurance Portability and Accountability Act | Public Law 104-191 (1996) | Omnibus Rule compliance 23 Sep 2013. Security Rule NPRM finalization expected May 2026. |
| **HDS** — Hébergeur de Données de Santé (Health Data Hosting) | v2.0 published Journal Officiel 16 May 2024 | Full compliance deadline: 16 May 2026. French/EEA requirement. |

### Information Security & Audit

| Standard | Current Version | Key Dates |
|----------|----------------|-----------|
| **SOC 2 Type 2** — AICPA Trust Services Criteria | 2017 TSC (Revised Points of Focus 2022) | Last updated 30 Sep 2023. Security category mandatory. |
| **PCI DSS** — Payment Card Industry Data Security Standard | v4.0.1 released 11 Jun 2024 | Sole active standard since 1 Jan 2025. All future-dated requirements mandatory 31 Mar 2025. |

### AI Governance

| Standard | Current Version | Key Dates |
|----------|----------------|-----------|
| **ISO 42001** — AI Management Systems | Edition 1, published 18 Dec 2023 | First certifiable AI management standard. 3-year cert with annual surveillance. |

### Upcoming Deadlines

| Deadline | Standard | Action Required |
|----------|----------|-----------------|
| **May 2026** | HIPAA Security Rule | NPRM finalization — major Security Rule overhaul |
| **May 16, 2026** | HDS v2.0 | All certificates must be v2.0; non-compliance becomes illegal |
| **October 2028** | ISO 27701:2025 | Transition from 2019 edition to standalone 2025 edition |
| **TBD (Trilogue)** | GDPR Omnibus | First substantive GDPR amendments since 2018 |

---

## Part II: SOC 2 Type 2 — AICPA Trust Services Criteria

> **Full Official Name**: SOC 2® — SOC for Service Organizations: Trust Services Criteria (formally "Reporting on an Examination of Controls at a Service Organization Relevant to Security, Availability, Processing Integrity, Confidentiality, or Privacy")
>
> **Governing Body**: American Institute of Certified Public Accountants (AICPA), Assurance Services Executive Committee (ASEC), now operating as AICPA & CIMA (Association of International Certified Professional Accountants)
>
> **Current Version**: 2017 Trust Services Criteria for Security, Availability, Processing Integrity, Confidentiality, and Privacy (With Revised Points of Focus — 2022). Formal reference: AICPA TSP Section 100.
>
> **Last Updated**: Revised points of focus published Fall 2022; document last updated September 30, 2023. The underlying 2017 criteria themselves have not changed — only the points of focus were revised to address evolving threats, technologies, and regulatory requirements.
>
> **Official Source**: https://www.aicpa-cima.com/topic/audit-assurance/audit-and-assurance-greater-than-soc-2

### Trust Services Categories

SOC 2 reports evaluate an organization's controls across five Trust Services Categories. Security is mandatory for every SOC 2 engagement; the remaining four are optional and selected based on the service organization's commitments and system requirements.

| Category | Series | Scope |
|----------|--------|-------|
| **Security** (Required) | CC1–CC9 | Protects information and systems against unauthorized access, disclosure, and damage. Integrated with COSO framework's 17 principles. |
| **Availability** | A Series | Systems available for operation and use as committed — uptime, DR, and BCP. |
| **Processing Integrity** | PI Series | System processing is complete, valid, accurate, timely, and authorized. |
| **Confidentiality** | C Series | Protects information designated as confidential under entity commitments, such as trade secrets, business plans, and intellectual property. |
| **Privacy** | P Series | Collection, use, retention, disclosure, and disposal of personal information in conformity with the entity's privacy notice and the AICPA's Generally Accepted Privacy Principles (GAPP). |

### Type 1 vs. Type 2

SOC 2 Type 1 evaluates the design of controls at a single point in time, answering whether controls are suitably designed. SOC 2 Type 2 evaluates both design and operating effectiveness over an observation period of typically 3–12 months, providing evidence that controls work consistently over time. Type 2 is considered the gold standard by enterprise customers and is increasingly required for vendor due diligence.

### Recent Updates (2022–2025)

- **Fall 2022**: Points of focus revision added guidance addressing evolving cybersecurity threats, distinctions between data controller and data processor roles for privacy, and updated data management requirements for confidentiality.
- **2022–2023**: SOC 2 Audit Guide update clarified description criteria, system boundaries (including third-party software), SOC 2+ report mappings to frameworks like HITRUST, NIST CSF, and HIPAA, and vendor risk management guidance.
- **July 2025**: The 2018 SOC 2 Description Criteria document was republished with revised implementation guidance. No new version of the underlying Trust Services Criteria (e.g., "2025 TSC") has been published as of February 2026.

**Official Documentation**: https://www.aicpa-cima.com/resources/download/2017-trust-services-criteria-with-revised-points-of-focus-2022

---

## Part III: GDPR — General Data Protection Regulation

> **Full Official Name**: Regulation (EU) 2016/679 of the European Parliament and of the Council of 27 April 2016 on the protection of natural persons with regard to the processing of personal data and on the free movement of such data, and repealing Directive 95/46/EC
>
> **Governing Bodies**: European Parliament & Council of the EU; enforced by national Data Protection Authorities (DPAs) via the European Data Protection Board (EDPB)
>
> **Current Version**: Regulation (EU) 2016/679 with corrigendum (OJ L 127, 23.5.2018). No substantive amendments enacted.
>
> **Key Dates**: Adopted 14 Apr 2016; entered into force 24 May 2016; enforcement began 25 May 2018
>
> **Official Source**: https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng

### Core Principles (Article 5)

Article 5 establishes seven foundational principles:

1. **Lawfulness, fairness, and transparency** in all processing activities
2. **Purpose limitation**: data collected for specified, explicit, and legitimate purposes
3. **Data minimisation**: adequate, relevant, and limited to what is necessary
4. **Accuracy**: kept up to date with reasonable measures to erase/rectify inaccurate data
5. **Storage limitation**: kept only as long as necessary for the purpose
6. **Integrity and confidentiality**: appropriate security measures including protection against unauthorized processing
7. **Accountability**: controller must demonstrate compliance with all principles

### Six Lawful Bases for Processing (Article 6)

1. **Consent** (freely given, specific, informed, unambiguous)
2. **Contractual necessity**
3. **Legal obligation**
4. **Vital interests**
5. **Public task**
6. **Legitimate interests** (subject to balancing test; not available to public authorities)

Processing of special category data under Article 9 — including race, health, biometrics, and political opinions — requires an additional legal basis beyond these six.

### Data Subject Rights (Articles 12–22)

The GDPR grants eight core rights:

- **Right of access** (Art. 15) — obtain confirmation and copies of personal data
- **Right to rectification** (Art. 16) — correction of inaccurate data
- **Right to erasure** ("right to be forgotten," Art. 17) — deletion of data
- **Right to restriction of processing** (Art. 18)
- **Right to data portability** (Art. 20) — receive data in machine-readable format for transfer to another controller
- **Right to object** (Art. 21) — covers processing based on legitimate interests; absolute right to object to direct marketing
- **Protection against automated decision-making** (Art. 22) — protection against decisions based solely on automated processing that produce legal or similarly significant effects

Controllers must respond within one month, extendable by two months for complex requests.

### Data Transfers and Residency

The GDPR does not mandate data residency within the EU, but regulates international transfers through three mechanisms:

1. **Adequacy decisions** by the European Commission (Art. 45)
2. **Appropriate safeguards** such as Standard Contractual Clauses and Binding Corporate Rules (Art. 46)
3. **Derogations** for specific situations (Art. 49)

A Data Protection Impact Assessment (DPIA) under Article 35 is required before processing likely to result in high risk.

### Enforcement and Penalties

| Tier | Violations | Maximum Fine |
|------|-----------|--------------|
| **Tier 1** | Failure to appoint DPO, conduct DPIAs, maintain records | EUR 10M or 2% global turnover |
| **Tier 2** | Breach of processing principles, data subject rights, transfer rules | EUR 20M or 4% global turnover |

Over EUR 6.2 billion in cumulative fines have been issued since 2018.

### 2025 Digital Omnibus Proposal

On 19 November 2025, the European Commission published the Digital Omnibus Package including targeted GDPR amendments. Key proposals:

- Narrowing the 'personal data' definition
- Extending breach notification from 72 to 96 hours
- Harmonizing DPIA requirements
- New provisions for AI model processing

This remains at proposal stage (currently in trilogue) and is not yet law. If enacted, it would represent the first substantive amendment to the GDPR since 2018.

---

## Part IV: HIPAA — Health Insurance Portability and Accountability Act

> **Full Official Name**: Health Insurance Portability and Accountability Act of 1996, Public Law 104-191
>
> **Governing Body**: U.S. Department of Health and Human Services (HHS), Office for Civil Rights (OCR)
>
> **Regulatory Location**: 45 CFR Parts 160, 162, and 164
>
> **Enacted**: August 21, 1996
>
> **Major Update**: Omnibus Final Rule — published Jan 25, 2013; compliance Sep 23, 2013
>
> **Pending Update**: Security Rule NPRM published Jan 6, 2025; finalization expected May 2026
>
> **Official Source**: https://www.hhs.gov/hipaa/for-professionals/index.html

### Component Rules

| Rule | Finalized | Compliance Date | Scope |
|------|-----------|-----------------|-------|
| **Privacy Rule** | Dec 28, 2000 | Apr 14, 2003 | National standards for PHI protection |
| **Security Rule** | Feb 20, 2003 | Apr 21, 2005 | Safeguards for electronic PHI (ePHI) |
| **Breach Notification** | Aug 2009 (IFR) | Sep 23, 2013 | Notification requirements for unsecured PHI |
| **Omnibus Rule** | Jan 25, 2013 | Sep 23, 2013 | Comprehensive update to all HIPAA rules |

The HITECH Act (enacted February 17, 2009) extended direct liability to business associates, created federal breach notification requirements, and established the four-tier penalty structure.

### Privacy Rule Key Provisions

The Privacy Rule establishes national standards to protect Protected Health Information (PHI). It applies to covered entities (health plans, health care clearinghouses, providers conducting electronic transactions) and their business associates. Permitted uses without authorization include treatment, payment, and health care operations (TPO). Patient rights include access to PHI, requesting amendments, receiving accounting of disclosures, requesting restrictions, and requesting confidential communications. The Minimum Necessary Standard limits PHI use to only what is needed for the purpose.

### Security Rule Safeguards

The Security Rule requires three categories of safeguards for electronic PHI (ePHI):

- **Administrative**: Risk analysis, security management process, workforce security, information access management, awareness and training, contingency planning, 6-year documentation retention
- **Physical**: Facility access controls, workstation use and security, device and media controls
- **Technical**: Access controls (unique user IDs, emergency access procedures, auto-logoff, encryption), audit controls, integrity mechanisms, transmission security

### Breach Notification Requirements

Covered entities must notify affected individuals within 60 days for breaches affecting 500+ individuals, with annual reporting for smaller breaches. Media notification is required for breaches affecting 500+ residents of a state or jurisdiction. Notification applies only to "unsecured" PHI not rendered unusable through encryption or destruction.

### Business Associate Agreements (BAAs)

Under 45 CFR 164.502(e) and 164.504(e), a written BAA is required whenever a covered entity engages a business associate that creates, receives, maintains, or transmits PHI. BAAs must:

- Specify permitted uses and disclosures
- Require the BA to implement appropriate safeguards including Security Rule compliance
- Mandate breach reporting
- Ensure PHI availability for individual access rights and amendments
- Require return or destruction of PHI at termination
- Ensure subcontractor flow-down of equivalent restrictions

Since the 2013 Omnibus Rule, business associates are directly liable for HIPAA violations.

### Penalty Structure

| Tier | Knowledge | Per Violation | Annual Cap |
|------|-----------|---------------|------------|
| **Tier 1** | Did not know | $141 – $71,162 | $71,162 |
| **Tier 2** | Reasonable cause | $1,424 – $71,162 | $71,162 |
| **Tier 3** | Willful neglect (corrected) | $14,232 – $71,162 | $71,162 |
| **Tier 4** | Willful neglect (not corrected) | $71,162 – $2,134,831 | $2,134,831 |

### 2025 Proposed Security Rule Update (NPRM)

Published December 27, 2024 (Federal Register January 6, 2025), this is the first major Security Rule update since 2013. The comment period closed March 7, 2025 with over 4,000 comments. Finalization is expected May 2026. Key proposed changes:

- **Removes 'required' vs. 'addressable' distinction** — all specifications become mandatory
- **Requires technology asset inventories** and network maps updated annually
- **Mandates encryption** of ePHI at rest and in transit
- **Requires multi-factor authentication** across all access points
- **Vulnerability scanning** every 6 months; **penetration testing** every 12 months
- **Mandates network segmentation** and 72-hour restoration procedures
- **Requires annual compliance audits** and 12-month business associate verification cycles

---

## Part V: ISO 27701 — Privacy Information Management Systems

> **Full Official Name**: ISO/IEC 27701:2025 — Privacy information management systems (Edition 2)
>
> **Governing Body**: International Organization for Standardization (ISO) and International Electrotechnical Commission (IEC), developed by ISO/IEC JTC 1/SC 27/WG 5
>
> **Current Version**: Edition 2, published 14 October 2025 (replacing the withdrawn Edition 1, ISO/IEC 27701:2019, published 6 August 2019)
>
> **Transition Deadline**: Organizations on 2019 edition must transition by October 2028
>
> **Official Source**: https://www.iso.org/standard/27701

### Major Change: Now a Standalone Standard

The most significant change in the 2025 edition is that ISO 27701 is now a fully standalone management system standard. The 2019 edition was an extension to ISO 27001 and ISO 27002, meaning organizations could not certify to 27701 without first holding ISO 27001 certification. The 2025 edition follows ISO's harmonized high-level structure (Clauses 4–10), enabling independent implementation and certification of a Privacy Information Management System (PIMS).

### Scope and Applicability

The standard specifies requirements for establishing, implementing, maintaining, and continually improving a PIMS. It applies to organizations of all types and sizes acting as PII Controllers and/or PII Processors — any entity processing personally identifiable information.

### Key Requirements and Controls

- Applies to organizations acting as PII Controllers and/or PII Processors
- Normative references reduced to only ISO/IEC 29100 (Privacy Framework)
- Includes only 29 information security controls from ISO 27001 with direct privacy impact — rather than the full 93 from ISO 27001:2022
- Annex A restructured into three consolidated tables:
  - **A.1** — PII Controller controls
  - **A.2** — PII Processor controls
  - **A.3** — 29 shared information security controls applicable to both
- Informative annexes provide direct mapping to GDPR requirements, plus alignment with CCPA, LGPD (Brazil), and other global privacy laws
- Covers leadership accountability, risk-based planning, measurable privacy objectives, data mapping, and evidence of control effectiveness
- Companion standard ISO/IEC 27706:2025 governs certification body requirements

### Transition Timeline

Organizations currently certified to ISO/IEC 27701:2019 must complete transition to the 2025 edition by **October 2028**. Certification bodies must offer 2025 edition assessments within 12 months of publication. New certifications issued after October 2026 should reference the 2025 edition.

---

## Part VI: ISO 42001 — AI Management Systems

> **Full Official Name**: ISO/IEC 42001:2023 — Information technology — Artificial intelligence — Management system
>
> **Governing Body**: International Organization for Standardization (ISO) and International Electrotechnical Commission (IEC), developed by ISO/IEC JTC 1 with members from 50+ countries
>
> **Current Version**: Edition 1, published 18 December 2023. No amendments or updates as of February 2026.
>
> **Certification**: 3-year validity with annual surveillance audits
>
> **Official Source**: https://www.iso.org/standard/42001

### The World's First Certifiable AI Management Standard

ISO/IEC 42001 is the first international certifiable standard for AI management systems. It applies to any organization that develops, provides, or uses products or services utilizing AI systems, regardless of size, type, or industry. The standard was developed over more than two years with members from over 50 countries.

### Requirements Structure (Clauses 4–10)

The standard follows the ISO Harmonized Structure and Plan-Do-Check-Act methodology:

| Clause | Title | Key Requirements |
|--------|-------|------------------|
| **4** | Context | Identify organizational role (AI provider, producer, customer) |
| **5** | Leadership | Top management commitment; establish AI policy |
| **6** | Planning | AI-specific risk assessment and treatment; Annex A control comparison |
| **7** | Support | Resources, competence, awareness, documented information |
| **8** | Operation | AI system lifecycle, impact assessments, development, maintenance |
| **9** | Performance | Monitoring, internal audits, management review |
| **10** | Improvement | Nonconformity, corrective actions, continual improvement |

### Annex A Controls (39–42 AI-Specific Controls)

Normative Annex A contains 39–42 AI-specific controls organized across 9 control areas:

1. **AI Policies**
2. **Internal Organization**
3. **Resources for AI Systems** (data, tooling, computing, human resources)
4. **Assessing Impacts of AI Systems**
5. **AI System Lifecycle**
6. **Data for AI Systems**
7. **Information for Interested Parties**
8. **Use of AI Systems**
9. **Third-Party and Customer Relationships**

Controls cover data quality, bias checks, human oversight, incident response, transparency, fairness, explainability, and model drift. Unlike ISO 27001, **all Annex A controls must be documented** (no Statement of Applicability exclusions).

### Alignment and Certification

The standard aligns with the EU AI Act, NIST AI RMF, and OECD AI Principles, and is compatible with ISO 27001/27701 via the shared harmonized structure. Full certification is available through accredited conformity assessment bodies, valid for 3 years with annual surveillance audits. Notable certified organizations include Microsoft (for Microsoft 365 Copilot) and Infosys. A 2025 CSA benchmark report found 76% of organizations planned to pursue ISO 42001 or similar frameworks. The standard requires more than 20 mandatory documents.

---

## Part VII: HDS — Health Data Hosting Certification

> **Full Official Name**: Certification Hébergeur de Données de Santé (HDS) / Health Data Hosting Certification
>
> **Governing Bodies**: Agence du Numérique en Santé (ANS) develops and maintains the framework; Délégation du Numérique en Santé (DNS) co-manages revisions; COFRAC (Comité Français d'Accréditation) accredits certification bodies
>
> **Regulatory Basis**: Article L.1111-8 of the French Public Health Code (Code de la santé publique); Articles R.1111-8-8 and R.1111-9; Décret n° 2018-137 du 26 février 2018
>
> **Current Version**: HDS v2.0 — published in the Journal Officiel on May 16, 2024 (Arrêté du 26 avril 2024), replacing HDS v1.1
>
> **Transition Deadline**: All certificates must be v2.0 by May 16, 2026
>
> **Official Source**: https://esante.gouv.fr/produits-services/hds

### Who Must Be Certified

Any natural or legal person hosting personal health data on digital media on behalf of healthcare establishments, healthcare professionals, patients, or third parties collecting health data must hold HDS certification. This applies to data collected during prevention, diagnosis, care, or medico-social activities. Pseudonymized data still requires HDS certification. Self-hosting by healthcare establishments managing their own IT systems is exempt.

### The Six Certified Activities

HDS certification covers six hosting activities across two certificate types:

| Certificate | Activities Covered |
|-------------|-------------------|
| **Certificate 1** (Physical Infrastructure) | Provision and maintenance of physical sites and hardware infrastructure for health data |
| **Certificate 2** (Managed Services) | Virtual infrastructure, application hosting platforms, administration/operation of health data IS, externalized backup |

### Key v2.0 Requirements

The major enhancement in v2.0 is **data sovereignty**:

- Physical hosting of health data must be within the **European Economic Area (EEA)**
- Any transfer to third countries must be documented, GDPR-compliant, and disclosed to clients
- Hosters must specify precise hosting locations (at minimum country level) and disclose exposure to extra-European law
- ISO 27001 certification is a prerequisite; HDS v2.0 aligned with ISO 27001:2022

Additional requirements include:

- Strict environment partitioning and rigorous access management under least privilege
- Data encryption at rest and in transit
- Incident management with detection and reporting procedures
- Traceability of all data access
- Business continuity and disaster recovery planning
- Enhanced subcontractor controls including monitoring of security measures and incident management

### Transition Timeline

Since November 16, 2024, all new initial audits and renewal audits must use v2.0. By **May 16, 2026**, all active HDS certificates must be on v2.0. After that date, hosting health data without v2.0 certification is illegal. As of 2024, there are 302+ certified hosters and 9 accredited certification bodies (including AFNOR, Apave, LNE, and BSI France).

---

## Part VIII: Data Privacy Framework — EU-U.S., UK Extension, Swiss-U.S.

> **Administered By**: U.S. Department of Commerce, International Trade Administration
>
> **EU-U.S. DPF**: Effective July 10, 2023 (Commission Implementing Decision EU 2023/1795)
>
> **UK Extension**: Effective October 12, 2023 (UK adequacy regulations in force)
>
> **Swiss-U.S. DPF**: Effective September 15, 2024 (Swiss Federal Administration recognition)
>
> **Legal Foundation**: Executive Order 14086 (October 7, 2022); Data Protection Review Court (DPRC)
>
> **Official Source**: https://www.dataprivacyframework.gov

### Three Component Frameworks

The Data Privacy Framework encompasses three distinct but interrelated frameworks:

1. **EU-U.S. Data Privacy Framework (EU-U.S. DPF)** — effective July 10, 2023
2. **UK Extension to the EU-U.S. DPF** (the "Data Bridge") — effective October 12, 2023
3. **Swiss-U.S. Data Privacy Framework (Swiss-U.S. DPF)** — effective September 15, 2024

### Seven Core Principles

Organizations self-certifying must commit to all seven principles:

1. **Notice** — Inform individuals about data collection and processing purposes
2. **Choice** — Opt-out for third-party disclosure; opt-in for sensitive data
3. **Accountability for Onward Transfer** — Contractual equivalence requirements for downstream recipients
4. **Security** — Reasonable and appropriate protective measures
5. **Data Integrity and Purpose Limitation** — Relevance, accuracy, and currency of data
6. **Access** — Right to access, correct, amend, or delete personal data
7. **Recourse, Enforcement, and Liability** — Robust compliance mechanisms including independent dispute resolution

### Self-Certification Process

Eligibility requires being a U.S.-based organization subject to FTC or DOT jurisdiction. Organizations apply via dataprivacyframework.gov, designating an Independent Recourse Mechanism (IRM) for dispute resolution, publicly posting a privacy policy reflecting DPF commitments, and establishing verification procedures. Annual re-certification is required.

Organizations covering HR data from the EU must designate EU DPAs as their IRM. The UK Extension requires EU-U.S. DPF participation as a prerequisite; the Swiss-U.S. DPF can be self-certified independently. Over 2,800 organizations were certified as of mid-2024, with 70% being SMEs.

### Enforcement and Redress

Enforcement operates through multiple mechanisms:

- FTC/DOT action under Section 5 of the FTC Act
- Independent recourse mechanisms at no cost to complainants
- EU DPA cooperation (especially for HR data)
- Binding arbitration for residual claims
- Data Protection Review Court (DPRC) for national security complaints

The Civil Liberties Protection Officer (CLPO) conducts initial investigation of government access complaints before DPRC appeal.

### Current Legal Status

On September 3, 2025, the EU General Court dismissed a legal challenge to the DPF adequacy decision (Latombe v. European Commission, Case T-553/23), finding the DPRC operates under sufficient independence guarantees and that the Commission's assessment was not manifestly erroneous. The decision may be appealed to the CJEU. The first annual review (July 2024) found U.S. authorities have implemented all constitutive elements.

**Structural vulnerability**: The DPF's legal basis rests on Executive Order 14086, which can be modified or revoked by a future administration without Congressional action — a structural fragility that distinguishes it from legislative frameworks.

---

## Part IX: PCI DSS — Payment Card Industry Data Security Standard

> **Full Official Name**: Payment Card Industry Data Security Standard (PCI DSS)
>
> **Governing Body**: PCI Security Standards Council (PCI SSC), founded by American Express, Discover Financial Services, JCB International, Mastercard, and Visa Inc.
>
> **Current Version**: PCI DSS v4.0.1, released June 11, 2024 as a limited revision of v4.0 (released March 31, 2022). PCI DSS v4.0 was retired December 31, 2024; v4.0.1 became the sole active standard on January 1, 2025. All 51 "future-dated" requirements became fully mandatory on March 31, 2025.
>
> **Official Source**: https://www.pcisecuritystandards.org/document_library

### The 12 Requirements

PCI DSS v4.0.1 contains over 300 controls organized under 12 principal requirements across six goals:

| Goal | Req | Description |
|------|-----|-------------|
| **Build/Maintain Secure Network** | 1 | Install and maintain network security controls with defined processes, configuration management, and CDE access restrictions |
| | 2 | Apply secure configurations to all system components; eliminate vendor-supplied defaults |
| **Protect Account Data** | 3 | Protect stored account data through minimized retention, prohibiting storage of sensitive authentication data after authorization, and securing PANs with cryptography |
| | 4 | Strong cryptography for cardholder data transmission over open, public networks |
| **Vulnerability Management** | 5 | Protect all systems from malicious software including anti-malware mechanisms and anti-phishing protections (new in v4.0) |
| | 6 | Develop and maintain secure systems and software; threat modeling; code reviews |
| **Strong Access Control** | 7 | Restrict access by business need to know |
| | 8 | Identify users and authenticate access; MFA for all CDE access (expanded from administrative-only in v3.2.1); minimum 12-character passwords (increased from 8) |
| | 9 | Restrict physical access to cardholder data environments |
| **Monitor/Test Networks** | 10 | Log and monitor all access to system components and cardholder data |
| | 11 | Regular security testing including vulnerability scanning, penetration testing, and detection of unauthorized changes on payment pages (new in v4.0) |
| **Security Policy** | 12 | Organizational security policies, risk assessments, employee training, personnel screening, third-party service provider management, and incident response |

### Key Changes from v3.2.1 to v4.0/v4.0.1

PCI DSS v4.0 introduced **64 new requirements** — the most significant update in the standard's history:

- **Customized Approach**: New flexible method for meeting requirements through alternative controls tailored to an organization's environment
- **MFA for all CDE access** (expanded from administrative-only in v3.2.1)
- **Payment page script monitoring**: Must track, authorize, and monitor all scripts on payment pages to prevent web-skimming attacks (Requirements 6.4.3 and 11.6.1)
- **Expanded vulnerability management**: Now covers all security vulnerabilities, not just critical/high-risk ones
- Greater emphasis on targeted risk analysis, continuous monitoring, and enhanced third-party service provider management
- **v4.0.1 clarifications**: 30-day patching applies only to critical vulnerabilities; refined MFA exceptions for phishing-resistant authentication; updated payment page script management applicability

### Compliance Timeline

| Date | Milestone |
|------|-----------|
| **March 31, 2024** | PCI DSS v3.2.1 officially retired |
| **June 11, 2024** | PCI DSS v4.0.1 released |
| **January 1, 2025** | v4.0.1 becomes sole active standard; all assessments must use v4.0.1 |
| **January 2025** | SAQ A update removed Requirements 6.4.3, 11.6.1, and 12.3.1 for merchants with fully outsourced payment functions |
| **March 31, 2025** | All 51 future-dated requirements become fully mandatory and enforceable |

---

## Part X: Critical Compliance Timelines

### Immediate Action Required (2026)

| Deadline | Standard | Action Required | Impact |
|----------|----------|-----------------|--------|
| **May 2026** | HIPAA Security Rule | NPRM finalization expected — major overhaul of Security Rule requirements | Removes addressable/required distinction; mandates encryption, MFA, network segmentation |
| **May 16, 2026** | HDS v2.0 | All active HDS certificates must be on v2.0; non-compliance becomes illegal | EEA data sovereignty requirement; ISO 27001 prerequisite |

### Medium-Term (2026–2028)

| Deadline | Standard | Action Required | Impact |
|----------|----------|-----------------|--------|
| **October 2028** | ISO 27701:2025 | Transition from 2019 edition to standalone 2025 edition | Now standalone — no longer requires ISO 27001 as prerequisite |
| **TBD (Trilogue)** | GDPR Digital Omnibus | First substantive GDPR amendments since 2018 | Narrowed personal data definition, extended breach notification, AI model provisions |

### Ongoing Obligations

| Standard | Cadence | Requirement |
|----------|---------|-------------|
| **SOC 2 Type 2** | Annual | Continuous control monitoring; 3–12 month observation periods |
| **ISO 42001** | Annual | Surveillance audits; 3-year recertification |
| **PCI DSS v4.0.1** | Quarterly/Annual | Vulnerability scans (quarterly); penetration tests (annual); all 300+ controls enforced |
| **DPF** | Annual | Re-certification; privacy policy updates; IRM designation |
| **HIPAA** | Ongoing | Risk analysis; workforce training; BAA management; breach notification within 60 days |

---

## Part XI: Cross-Framework Trends & Analysis

### Convergence on Risk-Based Frameworks

Across all eight standards, convergence on risk-based frameworks is accelerating. PCI DSS v4.0's Customized Approach, ISO 42001's AI-specific risk treatment, and the proposed HIPAA Security Rule's elimination of the "addressable" distinction all reflect a shift from checkbox compliance toward outcome-driven security. Organizations that adopt a unified risk management approach can satisfy multiple frameworks simultaneously.

### Data Sovereignty Requirements Tightening

Data sovereignty requirements are tightening across multiple jurisdictions:

- **HDS v2.0** now mandates EEA-only storage for health data
- The **GDPR Digital Omnibus** proposal would further harmonize transfer rules
- The **DPF's** structural dependence on an executive order remains a vulnerability — distinguishing it from legislative frameworks

### ISO Ecosystem Rapid Evolution

The ISO ecosystem is evolving rapidly:

- **ISO 27701** transformed from an ISO 27001 extension to a standalone standard (October 2025) — enabling independent privacy certification
- **ISO 42001** emerged as the first certifiable AI governance standard (December 2023) — reflecting the broadening scope of information management beyond traditional cybersecurity
- Both standards share the ISO Harmonized Structure, enabling integrated management systems

### AI Governance Emerging as Mandatory

ISO 42001's rapid adoption (76% of organizations planning certification per CSA 2025 benchmark) and the GDPR Digital Omnibus's new AI model processing provisions signal that AI governance is transitioning from voluntary best practice to regulatory expectation. RADIANT's built-in safety systems (CATO, HelixKernel deterministic safety, OMEGA self-awareness) position the platform favorably for ISO 42001 certification.

### RADIANT Platform Alignment

The RADIANT platform's architecture directly addresses requirements across all eight standards:

| Standard | RADIANT Capability |
|----------|-------------------|
| **SOC 2** | Merkle-chain audit trails, role-based access, continuous monitoring via heartbeat |
| **GDPR** | UDS erasure service, data portability, consent management, DPIA support |
| **HIPAA** | PHI encryption (AES-256-GCM with KMS), BAA-ready multi-tenancy, RLS isolation |
| **ISO 27701** | Privacy-by-design architecture, data mapping, tenant-scoped PII controls |
| **ISO 42001** | CATO safety pipeline, model drift governance, AI impact assessments, explainability |
| **HDS** | EEA-deployable CDK stacks, encryption at rest/transit, access traceability |
| **DPF** | Data transfer controls, privacy notices, dispute resolution integration |
| **PCI DSS** | Network segmentation, MFA enforcement, vulnerability scanning, log monitoring |

For detailed security and authentication architecture, see `docs/13-SECURITY-AUTH-COMPLIANCE.md`. For strategic security implementation including credential lifecycle and key rotation, see `docs/19-STRATEGIC-SECURITY.md`.

---

*Combined from three source documents: Compliance Standards List v1.0, Compliance Certifications & Regulatory Standards Guide v1.0, and Compliance/Regulatory Reference v1.0. Prepared February 13, 2026 for RADIANT Platform Compliance Documentation.*
