// 83,4 s vira "01:23"
export const fmtT = (t: number) => {
  const s = Math.max(0, Math.floor(t))
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')
}
