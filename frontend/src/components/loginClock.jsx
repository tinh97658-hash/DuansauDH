import React, { useEffect, useState } from "react";

const vietnamTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Ho_Chi_Minh",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
});

export default function LoginClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  return <time className="login-vietnam-time" dateTime={now.toISOString()} aria-label="Giờ Việt Nam">{vietnamTime.format(now)} GMT+7</time>;
}
