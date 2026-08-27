import React from "react";
import { Chip } from "@mui/material";
import CatalogManager from "../../components/CatalogManager";

const Majors = () => (
  <CatalogManager
    title="Ngành học"
    group="Danh mục đào tạo"
    desc="Danh mục ngành học, chuyên ngành đào tạo theo bậc Thạc sĩ & Tiến sĩ."
    endpoint="/system/majors"
    itemName="ngành học"
    codeLabel="Mã ngành"
    nameLabel="Tên ngành"
    sortable={false}
    fields={[
      {
        key: "program",
        label: "Trình độ / Bậc đào tạo",
        type: "select",
        options: [
          { value: "masters", label: "Thạc sĩ" },
          { value: "doctoral", label: "Tiến sĩ" },
        ],
        defaultValue: "masters",
        display: (row) => (
          <Chip
            size="small"
            label={row.program === "doctoral" ? "Tiến sĩ" : "Thạc sĩ"}
            color={row.program === "doctoral" ? "secondary" : "primary"}
            variant="outlined"
            sx={{ fontWeight: 600, fontSize: 11 }}
          />
        ),
      },
      { key: "isAdmissionScreening", label: "Xét tuyển đầu vào", type: "checkbox", defaultValue: false },
      { key: "durationYears", label: "Thời gian đào tạo (năm)", type: "number", min: 0.5, step: 0.5, defaultValue: 2 },
      { key: "maxOvertimeYears", label: "Thời gian vượt khung (năm)", type: "number", min: 0, step: 0.5, defaultValue: 2 },
      { key: "description", label: "Mô tả", type: "multiline" },
    ]}
  />
);
export default Majors;
