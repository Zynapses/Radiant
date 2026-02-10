// RADIANT v4.18.0 - Security Report Generator
// PDF report generation for individual tests and full battery results with compliance formatting

import Foundation
import AppKit
import PDFKit

@MainActor
final class SecurityReportGenerator {

    // MARK: - Report Types

    enum ReportScope {
        case singleTest(SecurityTest)
        case group(SOPGroup)
        case fullBattery(TestSuite)
    }

    // MARK: - Properties

    private let classification: String
    private let dateFormatter: DateFormatter
    private let isoFormatter: ISO8601DateFormatter

    // MARK: - Initialization

    init(classification: String = "CONFIDENTIAL") {
        self.classification = classification
        self.dateFormatter = DateFormatter()
        self.dateFormatter.dateStyle = .long
        self.dateFormatter.timeStyle = .short
        self.isoFormatter = ISO8601DateFormatter()
        self.isoFormatter.formatOptions = [.withInternetDateTime]
    }

    // MARK: - PDF Generation

    func generatePDF(scope: ReportScope, settings: SecurityTestSettings) -> Data? {
        let content = buildReportContent(scope: scope, settings: settings)
        return renderToPDF(content: content)
    }

    func savePDF(scope: ReportScope, settings: SecurityTestSettings) -> URL? {
        guard let pdfData = generatePDF(scope: scope, settings: settings) else { return nil }

        let fileName: String
        switch scope {
        case .singleTest(let test):
            fileName = "RADIANT-Security-\(test.id)-\(fileTimestamp()).pdf"
        case .group(let group):
            fileName = "RADIANT-Security-\(group.id)-\(fileTimestamp()).pdf"
        case .fullBattery:
            fileName = "RADIANT-Security-FullBattery-\(fileTimestamp()).pdf"
        }

        let outputDir: URL
        if let customDir = settings.reportOutputDirectory {
            outputDir = URL(fileURLWithPath: customDir)
        } else {
            outputDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
                .appendingPathComponent("RADIANT-Security-Reports")
        }

        try? FileManager.default.createDirectory(at: outputDir, withIntermediateDirectories: true)
        let fileURL = outputDir.appendingPathComponent(fileName)

        do {
            try pdfData.write(to: fileURL)
            return fileURL
        } catch {
            return nil
        }
    }

    // MARK: - Content Building

    private func buildReportContent(scope: ReportScope, settings: SecurityTestSettings) -> NSAttributedString {
        let content = NSMutableAttributedString()

        appendClassificationBanner(to: content)
        appendNewlines(to: content, count: 1)

        switch scope {
        case .singleTest(let test):
            appendSingleTestReport(test: test, to: content)
        case .group(let group):
            appendGroupReport(group: group, to: content)
        case .fullBattery(let suite):
            appendFullBatteryReport(suite: suite, to: content)
        }

        appendNewlines(to: content, count: 2)
        appendClassificationFooter(to: content)

        return content
    }

    // MARK: - Full Battery Report

    private func appendFullBatteryReport(suite: TestSuite, to content: NSMutableAttributedString) {
        appendHeading("RADIANT Endpoint Security Testing Report", level: 1, to: content)
        appendNewlines(to: content, count: 1)

        appendHeading("Executive Summary", level: 2, to: content)
        appendBody("Report Generated: \(dateFormatter.string(from: Date()))", to: content)
        appendBody("Suite Version: \(suite.version)", to: content)
        appendBody("Total Tests: \(suite.totalTests)", to: content)
        appendBody("Passed: \(suite.passedTests)  |  Failed: \(suite.failedTests)  |  Errors: \(suite.errorTests)  |  Skipped: \(suite.skippedTests)  |  Not Run: \(suite.notRunTests)", to: content)
        appendNewlines(to: content, count: 1)

        let passRate = suite.totalTests > 0 ? Double(suite.passedTests) / Double(suite.totalTests - suite.notRunTests) * 100 : 0
        appendBody("Overall Pass Rate: \(String(format: "%.1f", passRate))%", to: content)
        appendNewlines(to: content, count: 1)

        appendHeading("Results by Protocol", level: 2, to: content)
        for protocolType in TestProtocol.allCases {
            let groups = suite.groups.filter { $0.protocolType == protocolType }
            let tests = groups.flatMap(\.tests)
            let passed = tests.filter { $0.status == .passed }.count
            let failed = tests.filter { $0.status == .failed }.count
            let total = tests.count
            appendBody("  \(protocolType.displayName): \(passed)/\(total) passed, \(failed) failed", to: content)
        }
        appendNewlines(to: content, count: 1)

        let failedTests = suite.groups.flatMap(\.tests).filter { $0.status == .failed }
        if !failedTests.isEmpty {
            appendHeading("Failed Tests — Detailed Findings", level: 2, to: content)
            for test in failedTests {
                appendTestDetail(test: test, to: content)
                appendNewlines(to: content, count: 1)
            }
        }

        let errorTests = suite.groups.flatMap(\.tests).filter { $0.status == .error }
        if !errorTests.isEmpty {
            appendHeading("Error Tests — Requires Investigation", level: 2, to: content)
            for test in errorTests {
                appendTestDetail(test: test, to: content)
                appendNewlines(to: content, count: 1)
            }
        }

        appendHeading("Standards Compliance Matrix", level: 2, to: content)
        appendComplianceMatrix(suite: suite, to: content)

        appendHeading("All Test Results", level: 2, to: content)
        for group in suite.groups {
            appendHeading("\(group.id): \(group.title)", level: 3, to: content)
            for test in group.tests {
                let statusIcon: String
                switch test.status {
                case .passed: statusIcon = "✓"
                case .failed: statusIcon = "✗"
                case .error: statusIcon = "!"
                case .skipped: statusIcon = "—"
                case .notRun: statusIcon = "○"
                case .running: statusIcon = "⟳"
                }
                let duration = test.lastRunDuration.map { String(format: "%.2fs", $0) } ?? "—"
                appendBody("  [\(statusIcon)] \(test.id): \(test.title) (\(duration))", to: content)
            }
            appendNewlines(to: content, count: 1)
        }
    }

    // MARK: - Group Report

    private func appendGroupReport(group: SOPGroup, to content: NSMutableAttributedString) {
        appendHeading("RADIANT Security Test Group Report", level: 1, to: content)
        appendHeading("\(group.id): \(group.title)", level: 2, to: content)
        appendBody("Protocol: \(group.protocolType.displayName)", to: content)
        appendBody("Description: \(group.description)", to: content)
        appendBody("Tests: \(group.tests.count)  |  Passed: \(group.passedCount)  |  Failed: \(group.failedCount)  |  Errors: \(group.errorCount)", to: content)
        appendNewlines(to: content, count: 1)

        for test in group.tests {
            appendTestDetail(test: test, to: content)
            appendNewlines(to: content, count: 1)
        }
    }

    // MARK: - Single Test Report

    private func appendSingleTestReport(test: SecurityTest, to content: NSMutableAttributedString) {
        appendHeading("RADIANT Security Test Report", level: 1, to: content)
        appendTestDetail(test: test, to: content)
    }

    // MARK: - Test Detail

    private func appendTestDetail(test: SecurityTest, to content: NSMutableAttributedString) {
        appendHeading("\(test.id): \(test.title)", level: 3, to: content)
        appendBody("Status: \(test.status.displayName)", to: content)
        appendBody("Risk Severity: \(test.riskSeverity.rawValue)", to: content)
        appendBody("Protocol: \(test.protocolType.displayName)", to: content)
        appendBody("SOP Group: \(test.sopGroup)", to: content)

        if let date = test.lastRunDate {
            appendBody("Last Run: \(dateFormatter.string(from: date))", to: content)
        }
        if let duration = test.lastRunDuration {
            appendBody("Duration: \(String(format: "%.3f", duration))s", to: content)
        }

        appendNewlines(to: content, count: 1)
        appendBody("Description: \(test.description)", to: content)
        appendBody("Pass Criteria: \(test.passCriteria)", to: content)
        appendBody("Fail Criteria: \(test.failCriteria)", to: content)

        if let findings = test.detailedFindings, !findings.isEmpty {
            appendNewlines(to: content, count: 1)
            appendHeading("Findings", level: 4, to: content)
            appendBody(findings, to: content)
        }

        if let remediation = test.remediationGuidance, !remediation.isEmpty {
            appendNewlines(to: content, count: 1)
            appendHeading("Remediation", level: 4, to: content)
            appendBody(remediation, to: content)
        }

        if !test.standards.isEmpty {
            appendNewlines(to: content, count: 1)
            appendHeading("Mapped Standards", level: 4, to: content)
            for std in test.standards {
                appendBody("  • \(std.framework) \(std.control): \(std.title)", to: content)
            }
        }

        if !test.evidence.isEmpty {
            appendNewlines(to: content, count: 1)
            appendHeading("Evidence (\(test.evidence.count) items)", level: 4, to: content)
            for item in test.evidence {
                appendBody("  [\(item.type.rawValue)] \(item.title)", to: content)
                let preview = item.content.prefix(300)
                appendBody("  \(preview)\(item.content.count > 300 ? "... [TRUNCATED]" : "")", to: content)
            }
        }
    }

    // MARK: - Compliance Matrix

    private func appendComplianceMatrix(suite: TestSuite, to content: NSMutableAttributedString) {
        var frameworkMap: [String: [(test: SecurityTest, standard: StandardReference)]] = [:]

        for test in suite.groups.flatMap(\.tests) {
            for standard in test.standards {
                frameworkMap[standard.framework, default: []].append((test: test, standard: standard))
            }
        }

        for (framework, entries) in frameworkMap.sorted(by: { $0.key < $1.key }) {
            appendHeading(framework, level: 3, to: content)
            let controls = Dictionary(grouping: entries, by: { $0.standard.control })
            for (control, tests) in controls.sorted(by: { $0.key < $1.key }) {
                let allPassed = tests.allSatisfy { $0.test.status == .passed }
                let anyFailed = tests.contains { $0.test.status == .failed }
                let status = anyFailed ? "FAIL" : (allPassed ? "PASS" : "PARTIAL")
                appendBody("  [\(status)] \(control): \(tests.first?.standard.title ?? "") — \(tests.count) test(s)", to: content)
            }
            appendNewlines(to: content, count: 1)
        }
    }

    // MARK: - Text Formatting

    private func appendClassificationBanner(to content: NSMutableAttributedString) {
        let banner = NSAttributedString(
            string: "  \(classification) — RADIANT SECURITY TESTING REPORT  \n",
            attributes: [
                .font: NSFont.systemFont(ofSize: 10, weight: .bold),
                .foregroundColor: NSColor.white,
                .backgroundColor: NSColor(red: 0.7, green: 0.1, blue: 0.1, alpha: 1),
            ]
        )
        content.append(banner)
    }

    private func appendClassificationFooter(to content: NSMutableAttributedString) {
        let footer = NSAttributedString(
            string: "\n  \(classification) — Generated by RADIANT Deployer v4.18.0 — \(dateFormatter.string(from: Date()))  ",
            attributes: [
                .font: NSFont.systemFont(ofSize: 8, weight: .regular),
                .foregroundColor: NSColor.gray,
            ]
        )
        content.append(footer)
    }

    private func appendHeading(_ text: String, level: Int, to content: NSMutableAttributedString) {
        let fontSize: CGFloat
        let weight: NSFont.Weight
        switch level {
        case 1: fontSize = 22; weight = .bold
        case 2: fontSize = 16; weight = .bold
        case 3: fontSize = 13; weight = .semibold
        default: fontSize = 11; weight = .medium
        }
        let heading = NSAttributedString(
            string: "\(text)\n",
            attributes: [
                .font: NSFont.systemFont(ofSize: fontSize, weight: weight),
                .foregroundColor: NSColor.labelColor,
            ]
        )
        content.append(heading)
    }

    private func appendBody(_ text: String, to content: NSMutableAttributedString) {
        let body = NSAttributedString(
            string: "\(text)\n",
            attributes: [
                .font: NSFont.monospacedSystemFont(ofSize: 10, weight: .regular),
                .foregroundColor: NSColor.labelColor,
            ]
        )
        content.append(body)
    }

    private func appendNewlines(to content: NSMutableAttributedString, count: Int) {
        content.append(NSAttributedString(string: String(repeating: "\n", count: count)))
    }

    // MARK: - PDF Rendering

    private func renderToPDF(content: NSAttributedString) -> Data? {
        let pageWidth: CGFloat = 612
        let pageHeight: CGFloat = 792
        let margin: CGFloat = 50
        let textWidth = pageWidth - 2 * margin
        let textHeight = pageHeight - 2 * margin

        let textStorage = NSTextStorage(attributedString: content)
        let layoutManager = NSLayoutManager()
        textStorage.addLayoutManager(layoutManager)

        let textContainer = NSTextContainer(size: NSSize(width: textWidth, height: CGFloat.greatestFiniteMagnitude))
        textContainer.lineFragmentPadding = 0
        layoutManager.addTextContainer(textContainer)

        layoutManager.ensureLayout(for: textContainer)
        let totalHeight = layoutManager.usedRect(for: textContainer).height

        let pdfData = NSMutableData()
        var mediaBox = CGRect(x: 0, y: 0, width: pageWidth, height: pageHeight)

        guard let consumer = CGDataConsumer(data: pdfData as CFMutableData),
              let pdfContext = CGContext(consumer: consumer, mediaBox: &mediaBox, nil) else {
            return nil
        }

        var currentY: CGFloat = 0
        let glyphRange = layoutManager.glyphRange(for: textContainer)
        var pageGlyphStart = glyphRange.location

        while pageGlyphStart < NSMaxRange(glyphRange) {
            pdfContext.beginPage(mediaBox: &mediaBox)

            let nsGraphicsContext = NSGraphicsContext(cgContext: pdfContext, flipped: false)
            NSGraphicsContext.current = nsGraphicsContext

            let remainingRange = NSRange(location: pageGlyphStart, length: NSMaxRange(glyphRange) - pageGlyphStart)

            var pageGlyphRange = NSRange(location: pageGlyphStart, length: 0)
            var lineTop: CGFloat = 0

            layoutManager.enumerateLineFragments(forGlyphRange: remainingRange) { rect, _, _, lineGlyphRange, stop in
                if rect.origin.y - currentY + rect.height > textHeight {
                    stop.pointee = true
                    return
                }
                pageGlyphRange = NSUnionRange(pageGlyphRange, lineGlyphRange)
                lineTop = rect.origin.y + rect.height - currentY
            }

            if pageGlyphRange.length == 0 {
                pageGlyphRange = NSRange(location: pageGlyphStart, length: min(1, NSMaxRange(glyphRange) - pageGlyphStart))
                lineTop = textHeight
            }

            let drawOrigin = NSPoint(x: margin, y: pageHeight - margin)
            pdfContext.saveGState()
            pdfContext.translateBy(x: drawOrigin.x, y: drawOrigin.y)
            pdfContext.scaleBy(x: 1, y: -1)
            pdfContext.translateBy(x: 0, y: -currentY)

            layoutManager.drawBackground(forGlyphRange: pageGlyphRange, at: NSPoint(x: 0, y: currentY))
            layoutManager.drawGlyphs(forGlyphRange: pageGlyphRange, at: NSPoint(x: 0, y: currentY))

            pdfContext.restoreGState()
            pdfContext.endPage()

            currentY += lineTop
            pageGlyphStart = NSMaxRange(pageGlyphRange)
        }

        pdfContext.closePDF()
        NSGraphicsContext.current = nil

        return pdfData as Data
    }

    // MARK: - Helpers

    private func fileTimestamp() -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd-HHmmss"
        return f.string(from: Date())
    }
}
