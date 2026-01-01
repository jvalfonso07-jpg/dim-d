export function isShopOpen(): boolean {
  // Get current time in Philippines (Asia/Manila)
  const now = new Date();
  const options = { timeZone: 'Asia/Manila', hour: 'numeric', hour12: false };
  const formatter = new Intl.DateTimeFormat([], options);
  
  try {
    const timeString = formatter.format(now);
    const currentHour = parseInt(timeString);

    // Logic: Open if hour is >= 20 (8PM) OR hour is < 3 (3AM)
    return currentHour >= 20 || currentHour < 3;
  } catch (e) {
    console.error("Time check failed", e);
    return true; 
  }
}