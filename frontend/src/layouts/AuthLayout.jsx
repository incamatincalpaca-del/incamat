import "../styles/auth.css";

function AuthLayout({ children }) {
  return (
    <div className="login-container">
      <div className="overlay"></div>

      <div className="login-card">
        {children}
      </div>
    </div>
  );
}

export default AuthLayout;