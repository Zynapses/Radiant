import SwiftUI

struct DetailView: View {
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "sun.max.fill")
                .font(.system(size: 64))
                .foregroundStyle(.orange)
            
            Text("Welcome to Radiant")
                .font(.largeTitle)
                .fontWeight(.bold)
            
            Text("Select an item from the sidebar to get started")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

#Preview {
    DetailView()
}
