export async function sendLong(channel, text) { 
  const chunks = []; 
  let rest = String(text); 
  
  while (rest.length > 2000) { 
    let cut = rest.lastIndexOf('\n', 2000); 
    if (cut < 500) cut = rest.lastIndexOf(' ', 2000); 
    if (cut < 1) cut = 2000; 
    chunks.push(rest.slice(0, cut)); 
    rest = rest.slice(cut).trimStart(); 
  } 
  
  if (rest) chunks.push(rest); 
  
  for (const chunk of chunks) await channel.send(chunk); 
}

export function duration(ms) { 
  const s = Math.floor(ms / 1000), 
        d = Math.floor(s / 86400), 
        h = Math.floor(s % 86400 / 3600), 
        m = Math.floor(s % 3600 / 60); 
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m ${s%60}s`; 
}
