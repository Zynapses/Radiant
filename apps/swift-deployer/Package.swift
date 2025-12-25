// swift-tools-version: 5.9
// RADIANT Deployer - macOS Swift Package
// Platform: macOS 13.0+

import PackageDescription

let package = Package(
    name: "RadiantDeployer",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(name: "RadiantDeployer", targets: ["RadiantDeployer"])
    ],
    dependencies: [
        .package(url: "https://github.com/groue/GRDB.swift.git", from: "6.24.0"),
    ],
    targets: [
        .executableTarget(
            name: "RadiantDeployer",
            dependencies: [
                .product(name: "GRDB", package: "GRDB.swift"),
            ],
            path: "Sources/RadiantDeployer",
            exclude: [
                "Info.plist",
                "RadiantDeployer.entitlements",
            ],
            resources: [
                .copy("Resources/Infrastructure"),
                .copy("Resources/NodeRuntime"),
            ]
        ),
        .testTarget(
            name: "RadiantDeployerTests",
            dependencies: ["RadiantDeployer"],
            path: "Tests"
        ),
    ]
)
