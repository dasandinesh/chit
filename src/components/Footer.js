export default function Footer() {
  return (
    <footer className="app-footer">
      <div className="footer-content">
        <span className="footer-brand">Chit Manager</span>
        <span>© {new Date().getFullYear()} Chit Manager. All rights reserved.</span>
      </div>
    </footer>
  );
}
