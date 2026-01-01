export function isShopOpen(): boolean {
  // DEV MODE: Always return true so we can test
  return true;

  /* // ORIGINAL LOGIC (Uncomment this before you launch!)
  const now = new Date();
  
  // FIX: Added 'as const' to tell TypeScript these strings are strict option values
  const options = { 
    timeZone: 'Asia/Manila', 
    hour: 'numeric', 
    hour12: false 
  } as const; 

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
  */
}