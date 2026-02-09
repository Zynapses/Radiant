import SwiftUI

// MARK: - Cato Mood Selector View
// 5 personality moods with dropdown/inline/compact variants
// Mirrors: apps/thinktank/components/chat/cato-mood-selector.tsx

struct CatoMoodSelectorView: View {
    @Binding var selectedMood: CatoMood
    var variant: MoodSelectorVariant = .dropdown
    var disabled: Bool = false

    enum MoodSelectorVariant {
        case dropdown
        case inline
        case compact
    }

    var body: some View {
        switch variant {
        case .dropdown:
            dropdownVariant
        case .inline:
            inlineVariant
        case .compact:
            compactVariant
        }
    }

    // MARK: - Dropdown Variant

    private var dropdownVariant: some View {
        Menu {
            ForEach(CatoMood.allCases, id: \.self) { mood in
                Button {
                    selectedMood = mood
                } label: {
                    HStack {
                        Image(systemName: mood.systemImage)
                        VStack(alignment: .leading) {
                            Text(mood.displayName)
                            Text(mood.description)
                                .font(.caption2)
                        }
                        if mood == selectedMood {
                            Image(systemName: "checkmark")
                        }
                    }
                }
            }
        } label: {
            HStack(spacing: 8) {
                ZStack {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(moodColor(selectedMood).opacity(0.1))
                        .frame(width: 32, height: 32)
                    Image(systemName: selectedMood.systemImage)
                        .foregroundStyle(moodColor(selectedMood))
                }
                VStack(alignment: .leading, spacing: 1) {
                    Text(selectedMood.displayName)
                        .font(.caption.bold())
                    Text(selectedMood.description)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "chevron.up.chevron.down")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .padding(8)
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
        .disabled(disabled)
        .opacity(disabled ? 0.5 : 1)
    }

    // MARK: - Inline Variant

    private var inlineVariant: some View {
        HStack(spacing: 8) {
            ForEach(CatoMood.allCases, id: \.self) { mood in
                Button {
                    selectedMood = mood
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: mood.systemImage)
                            .font(.caption)
                        Text(mood.displayName)
                            .font(.caption)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(moodColor(mood).opacity(mood == selectedMood ? 0.2 : 0.05))
                    .foregroundStyle(mood == selectedMood ? moodColor(mood) : .secondary)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(mood == selectedMood ? moodColor(mood).opacity(0.5) : Color.clear, lineWidth: 1.5)
                    )
                }
                .buttonStyle(.plain)
                .disabled(disabled)
            }
        }
    }

    // MARK: - Compact Variant

    private var compactVariant: some View {
        Menu {
            ForEach(CatoMood.allCases, id: \.self) { mood in
                Button {
                    selectedMood = mood
                } label: {
                    HStack {
                        Image(systemName: mood.systemImage)
                        Text(mood.displayName)
                        if mood == selectedMood {
                            Image(systemName: "checkmark")
                        }
                    }
                }
            }
        } label: {
            HStack(spacing: 4) {
                Image(systemName: selectedMood.systemImage)
                    .foregroundStyle(moodColor(selectedMood))
                Image(systemName: "chevron.down")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .padding(6)
            .background(moodColor(selectedMood).opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .disabled(disabled)
        .opacity(disabled ? 0.5 : 1)
    }

    private func moodColor(_ mood: CatoMood) -> Color {
        switch mood {
        case .balanced: return .blue
        case .scout: return .green
        case .sage: return .purple
        case .spark: return .orange
        case .guide: return .pink
        }
    }
}
