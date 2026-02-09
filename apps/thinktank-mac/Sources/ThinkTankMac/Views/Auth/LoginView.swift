import SwiftUI

// MARK: - Login View
// Full authentication UI with email/password login
// Mirrors: apps/thinktank/lib/auth/context.tsx

struct LoginView: View {
    @ObservedObject var authService: AuthService
    @State private var email = ""
    @State private var password = ""
    @State private var showPassword = false
    @State private var rememberMe = true

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            VStack(spacing: 24) {
                VStack(spacing: 8) {
                    Image(systemName: "brain.head.profile")
                        .font(.system(size: 48))
                        .foregroundStyle(
                            LinearGradient(
                                colors: [.purple, .blue],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                    Text("Think Tank")
                        .font(.largeTitle.bold())
                    Text("Sign in to continue")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                VStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Email")
                            .font(.caption.bold())
                            .foregroundStyle(.secondary)
                        TextField("you@company.com", text: $email)
                            .textFieldStyle(.roundedBorder)
                            .textContentType(.emailAddress)
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Password")
                            .font(.caption.bold())
                            .foregroundStyle(.secondary)
                        HStack {
                            if showPassword {
                                TextField("Password", text: $password)
                                    .textFieldStyle(.roundedBorder)
                            } else {
                                SecureField("Password", text: $password)
                                    .textFieldStyle(.roundedBorder)
                            }
                            Button {
                                showPassword.toggle()
                            } label: {
                                Image(systemName: showPassword ? "eye.slash" : "eye")
                                    .foregroundStyle(.secondary)
                            }
                            .buttonStyle(.plain)
                        }
                    }

                    HStack {
                        Toggle("Remember me", isOn: $rememberMe)
                            .toggleStyle(.checkbox)
                            .font(.caption)
                        Spacer()
                    }
                }

                if let error = authService.error {
                    HStack(spacing: 6) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundStyle(.red)
                        Text(error)
                            .font(.caption)
                            .foregroundStyle(.red)
                    }
                    .padding(8)
                    .background(Color.red.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                }

                Button {
                    Task {
                        await authService.login(email: email, password: password)
                    }
                } label: {
                    if authService.isLoading {
                        ProgressView()
                            .controlSize(.small)
                            .frame(maxWidth: .infinity)
                    } else {
                        Text("Sign In")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(email.isEmpty || password.isEmpty || authService.isLoading)
                .keyboardShortcut(.return, modifiers: [])
            }
            .frame(width: 320)

            Spacer()

            #if DEBUG
            Button {
                authService.loginAsDevUser()
            } label: {
                Label("Dev Mode (Skip Login)", systemImage: "hammer.fill")
                    .font(.caption)
            }
            .buttonStyle(.plain)
            .foregroundStyle(.secondary)
            .padding(.bottom, 8)
            #endif

            HStack(spacing: 4) {
                Text("RADIANT Platform")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Text("v4.18.0")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
            .padding(.bottom, 16)
        }
        .frame(minWidth: 480, minHeight: 560)
        .background(
            LinearGradient(
                colors: [
                    Color(nsColor: .windowBackgroundColor),
                    Color(nsColor: .windowBackgroundColor).opacity(0.95),
                ],
                startPoint: .top,
                endPoint: .bottom
            )
        )
    }
}
