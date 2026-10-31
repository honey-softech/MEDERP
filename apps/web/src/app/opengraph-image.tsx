import { ImageResponse } from "next/og";

export const alt = "MedERP — clinic and hospital ERP for India";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#10211e",
          color: "#f6f3ec",
          padding: "72px 80px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 28,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: "#7dcec0",
          }}
        >
          Clinic ERP · India
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 92, fontWeight: 700, letterSpacing: -2 }}>MedERP</div>
          <div style={{ marginTop: 16, fontSize: 36, color: "#c9ddd6", maxWidth: 900 }}>
            OPD, billing, pharmacy, lab, and WhatsApp — one clinic record.
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 24, color: "#9ddecf" }}>mederp.co.in</div>
      </div>
    ),
    { ...size },
  );
}
