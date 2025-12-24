// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "Radiant",
    platforms: [
        .macOS(.v14)
    ],
    targets: [
        .executableTarget(
            name: "Radiant",
            path: "Sources/Radiant",
            resources: [
                .process("Resources")
            ]
        ),
    ]
)
