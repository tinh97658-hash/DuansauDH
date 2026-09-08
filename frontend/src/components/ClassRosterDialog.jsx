import React from "react";
import { Dialog } from "@mui/material";
import ClassRoster from "./ClassRoster";
export default function ClassRosterDialog(props) {
  return <Dialog open={Boolean(props.classId)} onClose={props.onClose} fullWidth maxWidth="md"><ClassRoster key={props.classId} {...props} /></Dialog>;
}
