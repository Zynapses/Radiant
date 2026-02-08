# RAWS v1.1 Administrator Documentation
## Operations and Administration Guide

---

**Document Version:** 1.1.0  
**RADIANT Platform Version:** v4.19.0  
**Last Updated:** January 2026  

---

## 1. System Overview

RAWS automatically selects optimal AI models using 8-dimension scoring across 13 weight profiles and 7 domains.

### Key Admin Responsibilities

- Model registry management
- Weight profile configuration
- Domain compliance enforcement
- Thermal state management
- Provider health monitoring
- Cost optimization

---

## 2. Regulatory Compliance by Domain

### 2.1 Compliance Matrix

| Domain | Required | Optional | Truth Engine |
|--------|----------|----------|--------------|
| **Healthcare** | HIPAA | FDA 21 CFR Part 11, HITECH | Required |
| **Financial** | SOC 2 Type II | PCI-DSS, GDPR, SOX | Required |
| **Legal** | SOC 2 Type II | GDPR, State Bar Rules | Required |
| **Scientific** | None | FDA 21 CFR Part 11, GLP, IRB | Optional |
| **Creative** | None | FTC Guidelines | Not Required |
| **Engineering** | None | SOC 2, ISO 27001, NIST CSF | Optional |
| **General** | None | None | Not Required |

### 2.2 Domain Regulatory Details

#### Healthcare Domain

**Mandatory Compliance:**
- **HIPAA** (Health Insurance Portability and Accountability Act)
  - Applies to: Any system processing Protected Health Information (PHI)
  - Requirements: Encryption at rest/transit, access controls, audit trails, Business Associate Agreements
  - RAWS Enforcement: Only HIPAA-certified models are eligible; selection filtered before scoring

**Conditional Compliance:**
- **FDA 21 CFR Part 11** (Electronic Records; Electronic Signatures)
  - Applies to: Clinical trials, drug development, medical device decisions
  - Requirements: Electronic record integrity, audit trails, electronic signatures
  - RAWS Enforcement: Models flagged as FDA-eligible when this compliance is required

- **HITECH Act**
  - Extends HIPAA for electronic health records
  - Increases penalties for HIPAA violations

**Admin Actions:**
```bash
# Verify HIPAA-eligible models
radiant-cli raws models list --compliance HIPAA --env production

# Healthcare selection audit
radiant-cli raws audit search --domain healthcare --last 30d --env production
```

#### Financial Domain

**Mandatory Compliance:**
- **SOC 2 Type II**
  - Applies to: Financial services handling customer data
  - Requirements: Security controls, availability, processing integrity, confidentiality, privacy
  - Audit Period: 6-12 months of operational evidence
  - RAWS Enforcement: SOC2-certified models only for financial domain

**Conditional Compliance:**
- **PCI-DSS** (Payment Card Industry Data Security Standard)
  - Applies to: Processing, storing, or transmitting payment card data
  - Requirements: Network security, access control, encryption, testing
  
- **GDPR** (General Data Protection Regulation)
  - Applies to: EU resident financial data
  - Requirements: Data minimization, consent, right to erasure, data portability

- **SOX** (Sarbanes-Oxley Act)
  - Applies to: Publicly traded companies
  - Requirements: Audit trail, internal controls, financial reporting integrity

- **SEC/FINRA Regulations**
  - Investment advice must not mislead
  - AI outputs used in investment decisions face regulatory scrutiny

**Admin Actions:**
```bash
# Financial compliance report
radiant-cli raws compliance report --framework SOC2 --domain financial --env production

# Check models with PCI-DSS
radiant-cli raws models list --compliance PCI_DSS --env production
```

#### Legal Domain

**Mandatory Compliance:**
- **SOC 2 Type II**
  - Protects attorney-client privilege
  - Ensures confidential document security
  - Required for legal tech platforms

**Conditional Compliance:**
- **ABA Model Rules of Professional Conduct**
  - Lawyers remain liable for AI outputs
  - Must maintain competent representation
  - Confidentiality obligations extend to AI tools

- **GDPR**
  - Required for EU data subjects in legal matters
  - Special categories of data (legal proceedings) have heightened protections

- **State Bar Requirements**
  - Many jurisdictions require disclosure of AI use in legal documents
  - Continuing education requirements on AI tools

**Admin Actions:**
```bash
# Legal domain with source citation requirement
radiant-cli raws domains get legal --env production

# Verify citation tracking enabled
radiant-cli raws config get truth_engine.require_citation --domain legal --env production
```

#### Scientific Domain

**No Mandatory Compliance** (varies by research type)

**Conditional Compliance:**
- **FDA 21 CFR Part 11**
  - Applies to: Pharmaceutical research, drug development
  - Required for submissions to regulatory agencies

- **GLP** (Good Laboratory Practice)
  - Applies to: Non-clinical laboratory studies
  - Required for studies submitted to FDA, EPA, etc.

- **IRB Approval** (Institutional Review Board)
  - Applies to: Human subjects research using AI tools
  - Required for federally funded research

- **NIH Data Management Requirements**
  - Data integrity for federally funded research
  - Public access requirements

- **Journal Disclosure Requirements**
  - Many journals require disclosure of AI use
  - ICMJE guidelines on AI authorship

**Admin Actions:**
```bash
# Scientific domain configuration
radiant-cli raws domains get scientific --env production

# Enable FDA compliance for pharma research
radiant-cli raws domains update scientific --add-compliance FDA_21_CFR --env production
```

#### Creative Domain

**No Mandatory Compliance**

**Considerations:**
- **FTC Guidelines**
  - AI-generated advertising may require disclosures
  - Endorsements using AI must be transparent

- **Copyright**
  - Not a compliance requirement but legal consideration
  - AI-generated content copyright status varies by jurisdiction

**Admin Actions:**
```bash
# Creative domain has no compliance requirements
radiant-cli raws domains get creative --env production

# Lowest ECD threshold - hallucinations acceptable
# ECD threshold: 0.20 (vs 0.05 for healthcare)
```

#### Engineering Domain

**No Mandatory Compliance** (varies by application)

**Conditional Compliance:**
- **SOC 2 Type II**
  - Required if AI-generated code processes sensitive data
  - Common for SaaS/enterprise applications

- **ISO 27001**
  - Information security management
  - Enterprise software development

- **NIST Cybersecurity Framework**
  - Recommended for security-sensitive applications
  - Federal government contractors

- **FDA 21 CFR Part 11**
  - Required for medical device software (SaMD)
  - Software in diagnostic or therapeutic devices

- **IEC 62443**
  - Industrial control systems
  - Critical infrastructure software

**Admin Actions:**
```bash
# Engineering domain - compliance varies by use case
radiant-cli raws domains get engineering --env production

# For medical device software, add FDA compliance
radiant-cli raws domains update engineering --add-compliance FDA_21_CFR --tenant medical-device-tenant
```

---

## 3. Weight Profile Management

### 3.1 All 13 System Profiles

| ID | Category | Primary Use |
|----|----------|-------------|
| BALANCED | Optimization | Default, general purpose |
| QUALITY_FIRST | Optimization | Maximum accuracy |
| COST_OPTIMIZED | Optimization | Budget-conscious |
| LATENCY_CRITICAL | Optimization | Real-time applications |
| HEALTHCARE | Domain | Medical/clinical (HIPAA) |
| FINANCIAL | Domain | Finance/investment (SOC2) |
| LEGAL | Domain | Contracts/litigation (SOC2) |
| SCIENTIFIC | Domain | Research/academic |
| CREATIVE | Domain | Content/marketing |
| ENGINEERING | Domain | Code/software |
| SYSTEM_1 | SOFAI | Fast, simple queries |
| SYSTEM_2 | SOFAI | Complex reasoning |
| SYSTEM_2_5 | SOFAI | Maximum reasoning |

### 3.2 Profile Compliance Mapping

```bash
# View profile with compliance requirements
radiant-cli raws profiles get HEALTHCARE --env production

# Output:
id: HEALTHCARE
weights: {Q: 0.30, C: 0.05, L: 0.10, K: 0.15, R: 0.10, P: 0.20, A: 0.05, E: 0.05}
constraints:
  minQualityScore: 80
  requiredCompliance: [HIPAA]
  forcedSystemType: SYSTEM_2
  requireTruthEngine: true
  maxEcdThreshold: 0.05
regulatory_rationale: |
  HIPAA mandatory for PHI. FDA 21 CFR Part 11 optional for clinical trials.
  High compliance weight (P=0.20) ensures only certified models selected.
  Quality threshold (80) prevents low-quality models for medical use.
  System 2 forced - no fast/cheap models for patient safety.
```

---

## 4. Domain Configuration

### 4.1 Domain Settings

```bash
# List all domains
radiant-cli raws domains list --env production

# Output:
┌─────────────┬──────────────────┬─────────┬─────────┬─────────────────┐
│ Domain      │ Profile          │ Min Q   │ ECD     │ Compliance      │
├─────────────┼──────────────────┼─────────┼─────────┼─────────────────┤
│ healthcare  │ HEALTHCARE       │ 80      │ 0.05    │ HIPAA           │
│ financial   │ FINANCIAL        │ 75      │ 0.05    │ SOC2            │
│ legal       │ LEGAL            │ 80      │ 0.05    │ SOC2            │
│ scientific  │ SCIENTIFIC       │ 70      │ 0.08    │ -               │
│ creative    │ CREATIVE         │ -       │ 0.20    │ -               │
│ engineering │ ENGINEERING      │ 70      │ 0.10    │ -               │
│ general     │ BALANCED         │ -       │ 0.10    │ -               │
└─────────────┴──────────────────┴─────────┴─────────┴─────────────────┘
```

### 4.2 Modifying Domain Compliance

```bash
# Add compliance requirement for a tenant's domain usage
radiant-cli raws domains tenant-override \
  --tenant enterprise-tenant \
  --domain engineering \
  --add-compliance SOC2 \
  --add-compliance ISO_27001 \
  --env production

# View tenant override
radiant-cli raws domains get engineering --tenant enterprise-tenant --env production
```

---

## 5. Compliance Monitoring

### 5.1 Compliance Dashboard

```bash
# Generate compliance summary
radiant-cli raws compliance summary --env production

# Output:
Compliance Summary (January 2026)
═══════════════════════════════════════════════════════════════
HIPAA Selections:        12,453 (100% compliant)
SOC2 Selections:         45,892 (100% compliant)
FDA 21 CFR Selections:      234 (100% compliant)
Non-Compliant Attempts:       0 (blocked at filter stage)

By Domain:
  healthcare:  12,453 selections │ HIPAA required │ 0 violations
  financial:   28,743 selections │ SOC2 required  │ 0 violations
  legal:       17,149 selections │ SOC2 required  │ 0 violations
  scientific:   8,234 selections │ optional       │ N/A
  creative:    15,892 selections │ none           │ N/A
  engineering: 22,156 selections │ optional       │ N/A
  general:     34,521 selections │ none           │ N/A
```

### 5.2 Compliance Reports

```bash
# Generate HIPAA compliance report for auditors
radiant-cli raws compliance report \
  --framework HIPAA \
  --period 2026-Q1 \
  --output hipaa-audit-q1-2026.pdf \
  --include-audit-trails \
  --env production

# Generate SOC 2 evidence package
radiant-cli raws compliance evidence \
  --framework SOC2 \
  --period 2025 \
  --output soc2-evidence-2025.zip \
  --env production
```

---

## 6. Model Compliance Status

### 6.1 Viewing Model Compliance

```bash
# List models by compliance certification
radiant-cli raws models list --compliance HIPAA --env production

# Output:
HIPAA-Certified Models (12 total):
┌─────────────────────┬───────────┬─────────┬─────────────────────────┐
│ Model               │ Provider  │ Quality │ Additional Compliance   │
├─────────────────────┼───────────┼─────────┼─────────────────────────┤
│ claude-opus-4-5     │ anthropic │ 87.2    │ SOC2, GDPR, HIPAA       │
│ claude-sonnet-4-5   │ anthropic │ 83.4    │ SOC2, GDPR, HIPAA       │
│ gpt-4o              │ openai    │ 79.2    │ SOC2, HIPAA             │
│ gpt-4-turbo         │ openai    │ 76.5    │ SOC2, HIPAA             │
│ gemini-2.5-pro      │ google    │ 82.3    │ SOC2, HIPAA, ISO_27001  │
│ ...                 │           │         │                         │
└─────────────────────┴───────────┴─────────┴─────────────────────────┘
```

### 6.2 Model Compliance Matrix

```bash
# Full compliance matrix
radiant-cli raws models compliance-matrix --env production

# Output shows which models have which certifications
```

---

## 7. Alerts and Notifications

### 7.1 Compliance Alerts

| Alert | Threshold | Severity | Action |
|-------|-----------|----------|--------|
| HIPAA model disabled | Any | Critical | SNS + PagerDuty |
| SOC2 cert expiring | 30 days | Warning | SNS + Slack |
| Compliance filter blocking >5% | Rate | Warning | SNS |
| Non-compliant selection attempt | Any | Info | Log only |

### 7.2 Alert Configuration

```bash
# Configure compliance alerts
radiant-cli raws alerts set compliance-expiry \
  --framework SOC2 \
  --days-before 30 \
  --severity warning \
  --notify slack:#compliance-alerts \
  --env production
```

---

## 8. Quick Reference

### Common Commands

```bash
# Compliance
radiant-cli raws compliance summary --env production
radiant-cli raws compliance report --framework HIPAA --env production
radiant-cli raws models list --compliance SOC2 --env production

# Domains
radiant-cli raws domains list --env production
radiant-cli raws domains get healthcare --env production

# Profiles  
radiant-cli raws profiles list --env production
radiant-cli raws profiles get HEALTHCARE --env production

# Audit
radiant-cli raws audit search --domain healthcare --last 24h --env production
```

### Compliance Contacts

| Framework | Internal Contact | External Auditor |
|-----------|------------------|------------------|
| HIPAA | compliance@radiant.example.com | [Auditor Name] |
| SOC 2 | security@radiant.example.com | [Auditor Name] |
| GDPR | privacy@radiant.example.com | [DPO Name] |
| FDA | regulatory@radiant.example.com | [Consultant] |

---

**End of Administrator Documentation**

*Version 1.1.0 | January 2026*
