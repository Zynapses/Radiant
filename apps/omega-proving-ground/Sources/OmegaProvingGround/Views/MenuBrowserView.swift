import SwiftUI

struct MenuBrowserView: View {
    @EnvironmentObject var appState: AppState
    @State private var menuData: [String: [[String: Any]]] = [:]
    @State private var isLoading = true
    @State private var errorMessage: String?

    private let simpleItemNames: Set<String> = [
        "French Fries", "Caramel Frappe"
    ]

    var body: some View {
        VStack(spacing: 0) {
            menuHeader
            Divider()

            if isLoading {
                loadingState
            } else if let error = errorMessage {
                errorState(error)
            } else {
                menuContent
            }
        }
        .frame(minWidth: 500)
        .task {
            loadMenuData()
        }
    }

    // MARK: - Header

    private var menuHeader: some View {
        HStack(spacing: 12) {
            Image(systemName: appState.selectedMenuCategory.icon)
                .font(.title2)
                .foregroundColor(appState.selectedMenuCategory.color)

            VStack(alignment: .leading, spacing: 2) {
                Text("McDonald's — \(appState.selectedMenuCategory.displayName)")
                    .font(.headline)
                Text(appState.selectedMenuCategory == .breakfast
                     ? "Breakfast items served until 10:30 AM"
                     : "Burgers, Chicken, Sides, Drinks & Desserts")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            let count = itemCount
            if count > 0 {
                Text("\(count) items")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Capsule().fill(Color.secondary.opacity(0.1)))
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color(nsColor: .windowBackgroundColor))
    }

    private var itemCount: Int {
        if appState.selectedMenuCategory == .breakfast {
            return menuData["breakfast"]?.count ?? 0
        } else {
            return MenuSubcategory.allCases.reduce(0) { $0 + (menuData[$1.rawValue]?.count ?? 0) }
        }
    }

    // MARK: - Content

    @ViewBuilder
    private var menuContent: some View {
        switch appState.selectedMenuCategory {
        case .breakfast:
            breakfastList
        case .mainMenu:
            mainMenuList
        }
    }

    private var breakfastList: some View {
        let items = menuData["breakfast"] ?? []
        return Group {
            if items.isEmpty {
                emptyCategory
            } else {
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                            MenuItemCard(item: item, accentColor: .yellow, showDescription: !isSimpleItem(item))
                        }
                    }
                    .padding(16)
                }
            }
        }
    }

    private var mainMenuList: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 20) {
                ForEach(MenuSubcategory.allCases) { sub in
                    let items = menuData[sub.rawValue] ?? []
                    if !items.isEmpty {
                        VStack(alignment: .leading, spacing: 10) {
                            HStack(spacing: 8) {
                                Image(systemName: sub.icon)
                                    .foregroundColor(sub.color)
                                    .font(.title3)
                                Text(sub.displayName)
                                    .font(.title3)
                                    .fontWeight(.semibold)
                                Text("(\(items.count))")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            .padding(.horizontal, 4)

                            ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                                MenuItemCard(item: item, accentColor: sub.color, showDescription: !isSimpleItem(item))
                            }
                        }
                    }
                }
            }
            .padding(16)
        }
    }

    private var emptyCategory: some View {
        VStack(spacing: 12) {
            Spacer()
            Image(systemName: "tray")
                .font(.system(size: 36))
                .foregroundColor(.secondary.opacity(0.5))
            Text("No items in this category")
                .font(.body)
                .foregroundColor(.secondary)
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    private func isSimpleItem(_ item: [String: Any]) -> Bool {
        guard let name = item["name"] as? String else { return false }
        return simpleItemNames.contains(name)
    }

    // MARK: - States

    private var loadingState: some View {
        VStack(spacing: 12) {
            Spacer()
            ProgressView()
            Text("Loading menu data...")
                .font(.caption)
                .foregroundColor(.secondary)
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: 12) {
            Spacer()
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 36))
                .foregroundColor(.orange)
            Text("Failed to load menu")
                .font(.headline)
            Text(message)
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
            Button("Retry") { loadMenuData() }
                .buttonStyle(.bordered)
            Spacer()
        }
        .frame(maxWidth: .infinity)
        .padding()
    }

    // MARK: - Data Loading

    private func loadMenuData() {
        isLoading = true
        errorMessage = nil

        guard let demoDir = appState.storageManager.findDemoDirectory() else {
            errorMessage = "Could not find demo/datasets directory"
            isLoading = false
            return
        }

        let path = "\(demoDir)/mcdonalds-knowledge.json"
        guard FileManager.default.fileExists(atPath: path) else {
            errorMessage = "mcdonalds-knowledge.json not found at \(path)"
            isLoading = false
            return
        }

        do {
            let data = try Data(contentsOf: URL(fileURLWithPath: path))
            guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let menu = json["menu"] as? [String: Any] else {
                errorMessage = "Invalid JSON structure — missing 'menu' key"
                isLoading = false
                return
            }

            var parsed: [String: [[String: Any]]] = [:]
            for (key, value) in menu {
                if let items = value as? [[String: Any]] {
                    parsed[key] = items
                }
            }
            menuData = parsed
            isLoading = false
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
        }
    }
}

// MARK: - Menu Item Card

struct MenuItemCard: View {
    let item: [String: Any]
    let accentColor: Color
    let showDescription: Bool

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            itemImage
            itemDetails
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(Color(nsColor: .controlBackgroundColor))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .strokeBorder(Color.secondary.opacity(0.1), lineWidth: 1)
        )
    }

    // MARK: - Image

    @ViewBuilder
    private var itemImage: some View {
        if let urlStr = item["image_url"] as? String, let url = URL(string: urlStr) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: 80, height: 80)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                case .failure:
                    imagePlaceholder
                case .empty:
                    ProgressView()
                        .frame(width: 80, height: 80)
                @unknown default:
                    imagePlaceholder
                }
            }
        } else {
            imagePlaceholder
        }
    }

    private var imagePlaceholder: some View {
        RoundedRectangle(cornerRadius: 8)
            .fill(accentColor.opacity(0.1))
            .frame(width: 80, height: 80)
            .overlay(
                Image(systemName: "fork.knife")
                    .font(.title2)
                    .foregroundColor(accentColor.opacity(0.4))
            )
    }

    // MARK: - Details

    private var itemDetails: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 8) {
                        Text(name)
                            .font(.headline)

                        if let comboNum = item["combo_num"] as? Int {
                            Text("#\(comboNum)")
                                .font(.caption2)
                                .fontWeight(.bold)
                                .foregroundColor(.white)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Capsule().fill(accentColor))
                        }
                    }

                    if showDescription, let desc = item["official_description"] as? String {
                        Text(desc)
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .lineLimit(2)
                    }
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 3) {
                    priceView
                    if let cals = calorieText {
                        Text(cals)
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
            }

            HStack(spacing: 12) {
                if let allergens = item["allergens"] as? [String], !allergens.isEmpty {
                    HStack(spacing: 4) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.caption2)
                            .foregroundColor(.orange)
                        Text(allergens.joined(separator: ", "))
                            .font(.caption2)
                            .foregroundColor(.orange)
                    }
                }

                if let customizable = item["customizable"] as? [String], !customizable.isEmpty {
                    HStack(spacing: 4) {
                        Image(systemName: "slider.horizontal.3")
                            .font(.caption2)
                            .foregroundColor(.blue)
                        Text("\(customizable.count) options")
                            .font(.caption2)
                            .foregroundColor(.blue)
                    }
                }

                if let aliases = item["aliases"] as? [String], !aliases.isEmpty {
                    HStack(spacing: 4) {
                        Image(systemName: "text.quote")
                            .font(.caption2)
                            .foregroundColor(.purple)
                        Text("aka: \(aliases.joined(separator: ", "))")
                            .font(.caption2)
                            .foregroundColor(.purple)
                    }
                }
            }

            if let ingredients = item["default_ingredients"] as? [String], !ingredients.isEmpty {
                Text(ingredients.joined(separator: " · "))
                    .font(.caption2)
                    .foregroundColor(.secondary.opacity(0.7))
                    .lineLimit(1)
            }

            if let note = item["note"] as? String {
                HStack(spacing: 4) {
                    Image(systemName: "info.circle")
                        .font(.caption2)
                    Text(note)
                        .font(.caption2)
                }
                .foregroundColor(.teal)
            }
        }
    }

    private var name: String {
        item["name"] as? String ?? "Unknown"
    }

    @ViewBuilder
    private var priceView: some View {
        if let price = item["price"] as? Double {
            VStack(alignment: .trailing, spacing: 2) {
                Text(String(format: "$%.2f", price))
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(.primary)
                if let mealPrice = item["meal_price"] as? Double {
                    Text(String(format: "Meal $%.2f", mealPrice))
                        .font(.caption2)
                        .foregroundColor(.green)
                }
            }
        } else if let prices = item["prices"] as? [String: Double] {
            VStack(alignment: .trailing, spacing: 2) {
                ForEach(Array(prices.sorted(by: { $0.value < $1.value })), id: \.key) { key, val in
                    Text("\(key.capitalized): \(String(format: "$%.2f", val))")
                        .font(.caption2)
                        .foregroundColor(.primary)
                }
            }
        } else {
            let sizeKeys = [("price_small", "S"), ("price_medium", "M"), ("price_large", "L")]
            let sizePrices = sizeKeys.compactMap { key, label -> (String, Double)? in
                guard let val = item[key] as? Double else { return nil }
                return (label, val)
            }
            if !sizePrices.isEmpty {
                VStack(alignment: .trailing, spacing: 2) {
                    ForEach(sizePrices, id: \.0) { label, val in
                        Text("\(label): \(String(format: "$%.2f", val))")
                            .font(.caption2)
                            .foregroundColor(.primary)
                    }
                }
            } else {
                Text("Price varies")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
    }

    private var calorieText: String? {
        if let cal = item["calories"] as? Int {
            return "\(cal) cal"
        } else if let cal = item["calories"] as? String {
            return "\(cal) cal"
        } else if let calDict = item["calories"] as? [String: Int] {
            let vals = calDict.values.sorted()
            if let lo = vals.first, let hi = vals.last, lo != hi {
                return "\(lo)–\(hi) cal"
            } else if let only = vals.first {
                return "\(only) cal"
            }
        }
        return nil
    }
}
