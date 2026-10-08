import React from "react";
import { Box, Paper, Typography } from "@mui/material";
import PersonRounded from "@mui/icons-material/PersonRounded";
import "./admissionPrint.css";

function DocumentField({ field, inline = false }) {
  const content = <><strong>{field.label}</strong>{" "}<span style={{ fontWeight: field.bold ? 700 : undefined, textTransform: field.uppercase ? "uppercase" : undefined }}>{field.value}</span></>;
  return inline ? content : <div>{content}</div>;
}

// Extracted from the existing detail A4 print sheet; retain its layout and styling.
export default function AdmissionPrintTemplate({ document }) {
  return (
  <Paper
    className="a4-paper-sheet" data-testid="admission-document"
    sx={{
      width: "210mm",
      height: "297mm",
      maxHeight: "297mm",
      bgcolor: "#FFFFFF",
      p: "10mm 13mm",
      borderRadius: "1px",
      fontFamily: '"Times New Roman", Times, "Liberation Serif", serif',
      color: "#000000",
      lineHeight: 1.35,
      fontSize: "12.5px",
      position: "relative",
      boxSizing: "border-box",
      border: "1.5px solid #173E75",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
    }}
  >
    {/* Header */}
    <Box sx={{ pb: 0.5 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", textAlign: "center" }}>
        <Box>
          <Typography sx={{ fontFamily: "inherit", fontSize: "11.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2px", lineHeight: 1.25 }}>
            {document.masthead[0]}
          </Typography>
          <Typography sx={{ fontFamily: "inherit", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", borderBottom: "1.2px solid #000", display: "inline-block", pb: 0.1, lineHeight: 1.25 }}>
            {document.masthead[1]}
          </Typography>
          <Typography sx={{ fontFamily: "inherit", fontSize: "10.5px", fontWeight: 700, mt: 0.3, color: "#1E293B", lineHeight: 1.2 }}>
            {document.masthead[2]}
          </Typography>
          <Typography sx={{ fontFamily: "inherit", fontSize: "10.5px", fontStyle: "italic", color: "#475569", lineHeight: 1.2 }}>
            Số HS: <strong>{document.displayCode}</strong>
          </Typography>
        </Box>

        <Box>
          <Typography sx={{ fontFamily: "inherit", fontSize: "11.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2px", lineHeight: 1.25 }}>
            {document.nationalHeading[0]}
          </Typography>
          <Typography sx={{ fontFamily: "inherit", fontSize: "12px", fontWeight: 700, borderBottom: "1.2px solid #000", display: "inline-block", pb: 0.1, lineHeight: 1.25 }}>
            {document.nationalHeading[1]}
          </Typography>
          <Typography sx={{ fontFamily: "inherit", fontSize: "10.5px", fontStyle: "italic", mt: 0.3, color: "#475569", lineHeight: 1.2 }}>
            {document.dateLine}
          </Typography>
        </Box>
      </Box>
    </Box>

    {/* Title */}
    <Box sx={{ textAlign: "center", my: 0.5 }}>
      <Typography sx={{ fontFamily: "inherit", fontSize: "17px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", lineHeight: 1.2 }}>
        {document.title}
      </Typography>
      <Typography sx={{ fontFamily: "inherit", fontSize: "12px", fontStyle: "italic", fontWeight: 600, color: "#334155", lineHeight: 1.2 }}>
        {document.subtitle}
      </Typography>
    </Box>

    {/* Section I: Personal Info & Photo */}
    <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
      <Box
        sx={{
          width: 90,
          height: 120,
          border: "1px solid #173E75",
          borderRadius: "2px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          overflow: "hidden",
          bgcolor: "#F8FAFC",
          textAlign: "center",
        }}
      >
        {document.photo ? (
          <img src={document.photo} alt="Ảnh 3x4" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Box sx={{ p: 0.5 }}>
            <PersonRounded sx={{ fontSize: 24, color: "#94A3B8", mb: 0.3 }} />
            <Typography sx={{ fontFamily: "inherit", fontSize: "9.5px", fontStyle: "italic", color: "#64748B", lineHeight: 1.15 }}>
              Ảnh 3x4<br />(Đóng dấu giáp lai)
            </Typography>
          </Box>
        )}
      </Box>

      <Box sx={{ flexGrow: 1 }}>
        <Typography sx={{ fontFamily: "inherit", fontWeight: 700, fontSize: "12.5px", mb: 0.3, textTransform: "uppercase", pb: 0.2 }}>
          {document.sections[0].title}
        </Typography>

        <Box sx={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", rowGap: 0.25, fontSize: "12px", lineHeight: 1.3 }}>
          {document.sections[0].fields.map((field) => <DocumentField key={field.label} field={field} />)}
        </Box>
        <div style={{ marginTop: "3px", fontSize: "12px", lineHeight: 1.3 }}>
          <DocumentField field={document.sections[0].extra} inline />
        </div>
      </Box>
    </Box>

    {/* Section II: Training Mode & Program */}
    <Box>
      <Typography sx={{ fontFamily: "inherit", fontWeight: 700, fontSize: "12.5px", mb: 0.3, textTransform: "uppercase", pb: 0.2 }}>
        {document.sections[1].title}
      </Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", rowGap: 0.25, fontSize: "12px", lineHeight: 1.3 }}>
        {document.sections[1].fields.map((field) => <DocumentField key={field.label} field={field} />)}
      </Box>
    </Box>

    {/* Section III: Undergraduate Qualifications */}
    <Box>
      <Typography sx={{ fontFamily: "inherit", fontWeight: 700, fontSize: "12.5px", mb: 0.3, textTransform: "uppercase", pb: 0.2 }}>
        {document.sections[2].title}
      </Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", rowGap: 0.25, fontSize: "12px", lineHeight: 1.3 }}>
        {document.sections[2].fields.map((field) => <DocumentField key={field.label} field={field} />)}
      </Box>
      {document.sections[2].extra && (
        <div style={{ marginTop: "3px", fontSize: "12px", lineHeight: 1.3 }}>
          <DocumentField field={document.sections[2].extra} inline />
        </div>
      )}
    </Box>

    {/* Section IV: Attached Documents Checklist */}
    <Box>
      <Typography sx={{ fontFamily: "inherit", fontWeight: 700, fontSize: "12.5px", mb: 0.3, textTransform: "uppercase", pb: 0.2 }}>
        {document.checklistTitle}
      </Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", rowGap: 0.35, columnGap: 1, fontSize: "11.5px", lineHeight: 1.2 }}>
        {document.documents.map((doc) => {
          const isChecked = doc.checked;
          return (
            <div key={doc.key} style={{ display: "flex", alignItems: "center" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 12,
                  height: 12,
                  border: "1.2px solid #000000",
                  borderRadius: 2,
                  marginRight: 5,
                  fontSize: 9,
                  fontWeight: "bold",
                  lineHeight: 1,
                  backgroundColor: "#fff",
                  color: "#000",
                  flexShrink: 0,
                }}
              >
                {isChecked ? "✓" : ""}
              </span>
              <span>{doc.label}</span>
            </div>
          );
        })}
      </Box>
    </Box>

    {/* Section V: Signatures */}
    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1.1fr 1fr", textAlign: "center", pt: 0.5, pageBreakInside: "avoid", breakInside: "avoid" }}>
      <Box>
        <Typography sx={{ fontFamily: "inherit", fontSize: "11px", fontStyle: "italic", color: "#334155", lineHeight: 1.2 }}>
          {document.signatures[0].date}
        </Typography>
        <Typography sx={{ fontFamily: "inherit", fontWeight: 700, fontSize: "12px", textTransform: "uppercase", mt: 0.2, lineHeight: 1.2 }}>
          {document.signatures[0].title}
        </Typography>
        <Typography sx={{ fontFamily: "inherit", fontSize: "10.5px", fontStyle: "italic", lineHeight: 1.2 }}>{document.signatures[0].instruction}</Typography>
        <Box sx={{ height: 42 }} />
        <Typography sx={{ fontFamily: "inherit", fontWeight: 700, textTransform: "uppercase", fontSize: "12px" }}>{document.signatures[0].name}</Typography>
      </Box>

      <Box>
        <Typography sx={{ fontFamily: "inherit", fontSize: "11px", fontStyle: "italic", color: "#334155", lineHeight: 1.2 }}>
          {document.signatures[1].date}
        </Typography>
        <Typography sx={{ fontFamily: "inherit", fontWeight: 700, fontSize: "12px", textTransform: "uppercase", mt: 0.2, lineHeight: 1.2 }}>
          {document.signatures[1].title}
        </Typography>
        <Typography sx={{ fontFamily: "inherit", fontSize: "10.5px", fontStyle: "italic", lineHeight: 1.2 }}>{document.signatures[1].instruction}</Typography>
        <Box sx={{ height: 42 }} />
      </Box>

      <Box>
        <Typography sx={{ fontFamily: "inherit", fontSize: "11px", fontStyle: "italic", color: "#334155", lineHeight: 1.2 }}>
          {document.signatures[2].date}
        </Typography>
        <Typography sx={{ fontFamily: "inherit", fontWeight: 700, fontSize: "12px", textTransform: "uppercase", mt: 0.2, lineHeight: 1.2 }}>
          {document.signatures[2].title}
        </Typography>
        <Typography sx={{ fontFamily: "inherit", fontSize: "10.5px", fontStyle: "italic", lineHeight: 1.2 }}>{document.signatures[2].instruction}</Typography>
        <Box sx={{ height: 42 }} />
      </Box>
    </Box>
  </Paper>
  );
}
