// swift-tools-version: 5.9
// Think Tank (Mac) — Native macOS client for RADIANT Think Tank

import PackageDescription

let package = Package(
    name: "ThinkTankMac",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(name: "ThinkTankMac", targets: ["ThinkTankMac"]),
    ],
    dependencies: [
        .package(url: "https://github.com/apple/swift-markdown.git", from: "0.3.0"),
        .package(url: "https://github.com/raspu/Highlightr.git", from: "2.1.0"),
        .package(url: "https://github.com/SwiftyJSON/SwiftyJSON.git", from: "5.0.0"),
    ],
    targets: [
        .executableTarget(
            name: "ThinkTankMac",
            dependencies: [
                .product(name: "Markdown", package: "swift-markdown"),
                .product(name: "Highlightr", package: "Highlightr"),
                .product(name: "SwiftyJSON", package: "SwiftyJSON"),
            ],
            path: "Sources/ThinkTankMac",
            resources: [
                .process("Resources"),
            ]
        ),
    ]
)
