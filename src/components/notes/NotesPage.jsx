import NotesTab from "./NotesTab.jsx";

function getAccentTextColor(hexColor) {
  if (!hexColor || !/^#[0-9A-F]{6}$/i.test(hexColor)) return "#0a0a0f";
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance < 140 ? "#ffffff" : "#0a0a0f";
}

export default function NotesPage({ currency = "USD", profile }) {
  const accentColor = profile?.theme_color;
  const accentTextColor = getAccentTextColor(accentColor);

  return (
    <div
      className="dashboard-container"
      style={{
        "--accent": accentColor,
        "--notes-accent-text": accentTextColor,
      }}
    >
      <div style={{ maxWidth: "1400px", margin: "0 auto", width: "100%" }}>
        <NotesTab currency={currency} />
      </div>
    </div>
  );
}
