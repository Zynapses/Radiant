// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "OmegaProvingGround",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(name: "OmegaProvingGround", targets: ["OmegaProvingGround"])
    ],
    targets: [
        .executableTarget(
            name: "OmegaProvingGround",
            path: "Sources/OmegaProvingGround"
        )
    ]
)
