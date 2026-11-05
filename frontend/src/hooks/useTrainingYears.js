import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { API_BASE_URL } from "../config/http";

export default function useTrainingYears(selectedYear, setSelectedYear) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let mounted = true;
    axios.get(`${API_BASE_URL}/system/training-years`, { withCredentials: true })
      .then(({ data }) => {
        if (mounted) setRows((Array.isArray(data) ? data : data.data || []).filter(row => row.active));
      })
      .catch(() => { if (mounted) toast.error("Không thể tải danh mục năm đào tạo."); });
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    if (!rows || !setSelectedYear || !selectedYear || rows.some(row => row.name === selectedYear)) return;
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
    const started = rows.filter(row => row.startDate <= today).sort((a, b) => b.startDate.localeCompare(a.startDate));
    setSelectedYear(started[0]?.name || rows[0]?.name || "");
  }, [rows, selectedYear, setSelectedYear]);
  return rows ? rows.map(row => row.name).sort() : (selectedYear ? [selectedYear] : []);
}
