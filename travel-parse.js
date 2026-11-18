// Travel Schedule document reader (v3.10.409).
// Pure text → data functions, kept separate from app.js so they can be tested on real Izani /
// XL Embassy documents outside the browser. app.js turns the uploaded file into lines (mammoth
// for Word, pdf.js for PDF) and hands them here.
//
// parseTravelDoc({lines, items}) → {kind:'flight'|'accom'|'unknown', flights:[], accom:null|{}}
//   lines: text lines in reading order
//   items: (PDF only) [{str,x,y,h}] — used to find the establishment name (largest text on a voucher)

// Airports most likely on a Carte Blanche ticket → readable name. Unknown codes just show the code.
export const AIRPORTS={
  JNB:'O.R. Tambo (Johannesburg)',HLA:'Lanseria (Johannesburg)',CPT:'Cape Town',DUR:'King Shaka (Durban)',
  PLZ:'Gqeberha',ELS:'East London',GRJ:'George',BFN:'Bloemfontein',KIM:'Kimberley',MQP:'Kruger Mpumalanga (Mbombela)',
  PTG:'Polokwane',UTN:'Upington',PHW:'Phalaborwa',HDS:'Hoedspruit',MBD:'Mahikeng',RCB:'Richards Bay',UTT:'Mthatha',
  PZB:'Pietermaritzburg',SZK:'Skukuza',PBZ:'Plettenberg Bay',MGH:'Margate',
  WDH:'Windhoek',WVB:'Walvis Bay',GBE:'Gaborone',MUB:'Maun',BBK:'Kasane',MSU:'Maseru',SHO:'Eswatini (King Mswati III)',
  MPM:'Maputo',VFA:'Victoria Falls',HRE:'Harare',BUQ:'Bulawayo',LUN:'Lusaka',LVI:'Livingstone',LLW:'Lilongwe',BLZ:'Blantyre',
  NBO:'Nairobi',EBB:'Entebbe',DAR:'Dar es Salaam',ZNZ:'Zanzibar',KGL:'Kigali',ADD:'Addis Ababa',LOS:'Lagos',ABV:'Abuja',
  ACC:'Accra',LAD:'Luanda',MRU:'Mauritius',SEZ:'Seychelles',TNR:'Antananarivo',CAI:'Cairo',CMN:'Casablanca',
  DXB:'Dubai',DOH:'Doha',AUH:'Abu Dhabi',IST:'Istanbul',LHR:'London Heathrow',LGW:'London Gatwick',CDG:'Paris',
  FRA:'Frankfurt',MUC:'Munich',AMS:'Amsterdam',ZRH:'Zurich',JFK:'New York JFK',ATL:'Atlanta',IAD:'Washington Dulles',
  PER:'Perth',SYD:'Sydney',HKG:'Hong Kong',SIN:'Singapore',BOM:'Mumbai',DEL:'Delhi',GRU:'São Paulo',
};
export function airportName(code){return AIRPORTS[String(code||'').toUpperCase()]||'';}

const MONTHS={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
const pad=n=>String(n).padStart(2,'0');
function isoFromParts(d,mon,y){
  const m=MONTHS[String(mon).slice(0,3).toLowerCase()];
  if(!m)return'';
  let yr=Number(y);
  if(yr<100)yr+=2000;
  return`${yr}-${pad(m)}-${pad(Number(d))}`;
}
function titleCase(s){
  return String(s).toLowerCase().replace(/(^|[\s'\-])([a-zà-ÿ])/g,(m,a,b)=>a+b.toUpperCase());
}
// "KEKANA/MASACLAIR MS" → "Masaclair Kekana"
function ticketName(sur,first){
  return titleCase(`${first.trim()} ${sur.trim()}`).replace(/\s+/g,' ');
}
// "Peens A" → "A Peens"
function voucherName(s){
  const m=String(s).trim().match(/^(.+?)\s+([A-Z](?:\.?\s?[A-Z])*\.?)$/);
  return m?`${m[2].replace(/\.$/,'')} ${titleCase(m[1])}`:titleCase(s);
}
const uniq=a=>[...new Set(a.filter(Boolean))];

// ── Flights (Electronic Ticket Receipt and Itinerary) ─────────────────
function parseFlights(text){
  const flights=[];
  const passengers=uniq([...text.matchAll(/\b([A-Z][A-Z'\-]+(?: [A-Z][A-Z'\-]+)*)\/([A-Z][A-Z'\- ]*?)\s+(?:MRS|MR|MS|MISS|MSTR|DR|PROF)\b/g)]
    .map(m=>ticketName(m[1],m[2])));
  const airline=(text.match(/Issuing Airline\s+([A-Za-z][A-Za-z .&'\-]{1,40}?)\s+(?:Date of Issue|Passenger|Electronic|Frequent|Travel Agency)/)||[])[1]||'';
  const city='([A-Za-z][A-Za-z .\'\\-()/]{1,40}?)';
  // "Flight Details" table: Tue 24 Nov 26 FA301 HLA Johannesburg CPT Cape Town 07:00 09:15
  const re=new RegExp(`\\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,? (\\d{1,2}) ([A-Za-z]{3})[a-z]* (\\d{2,4}) ([A-Z0-9]{2}) ?(\\d{1,4}[A-Z]?) ([A-Z]{3}) (?:${city} )?([A-Z]{3}) (?:${city} )?(\\d{1,2}:\\d{2}) (\\d{1,2}:\\d{2})`,'g');
  for(const m of text.matchAll(re)){
    flights.push({date:isoFromParts(m[1],m[2],m[3]),flightNo:`${m[4]}${m[5]}`,from:m[6],to:m[8],depart:m[10],arrive:m[11]});
  }
  // Fallback: the summary table only (no arrival time, no year) — "1 FA 301 Tue, 24 Nov Z HLA CPT 07:00"
  if(!flights.length){
    const issueYr=(text.match(/Date of Issue\s+\w+,? \d{1,2} [A-Za-z]+ (\d{4})/)||[])[1]||String(new Date().getFullYear());
    const re2=/\b([A-Z0-9]{2}) (\d{1,4}[A-Z]?) (?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,? (\d{1,2}) ([A-Za-z]{3})[a-z]* [A-Z] ([A-Z]{3}) ([A-Z]{3}) (\d{1,2}:\d{2})/g;
    for(const m of text.matchAll(re2)){
      flights.push({date:isoFromParts(m[3],m[4],issueYr),flightNo:`${m[1]}${m[2]}`,from:m[5],to:m[6],depart:m[7],arrive:''});
    }
  }
  const seen=new Set();
  return flights.filter(f=>{const k=f.date+f.flightNo;if(seen.has(k))return false;seen.add(k);return true;})
    .map(f=>({...f,airline,passengers}));
}

// ── Accommodation voucher ─────────────────────────────────────────────
function parseAccom(text,lines,items){
  const dmy=label=>{
    const m=text.match(new RegExp(`${label}\\s*:?\\s*(?:[A-Za-z]+,?\\s+)?(\\d{1,2})[\\/.\\-](\\d{1,2})[\\/.\\-](\\d{4})(?:\\s+(?:at\\s+)?(\\d{1,2}[:h]\\d{2}))?`,'i'));
    return m?{date:`${m[3]}-${pad(m[2])}-${pad(m[1])}`,time:m[4]?m[4].replace('h',':'):''}:{date:'',time:''};
  };
  const ci=dmy('Check[ -]?In'),co=dmy('Check[ -]?Out');
  const order=(text.match(/\bOrder\s*(?:No\.?|Number)?\s*:?\s*(\d{2,6})\b/i)||[])[1]||'';
  // "Peens A, Visser R, Pretorius F, Kekana M (4 Pax)" — each comma piece ends in "Surname I";
  // only the tail of each piece is kept so headings in front of the list don't leak in.
  const guestsM=text.match(/([^()]{0,300})\(\s*\d+\s*Pax\s*\)/i);
  const nameTail=/((?:(?:[Vv]an|[Dd]e|[Dd]u|[Ll]e|[Vv]on|[Dd]er|[Ll]a) )*[A-Z][a-z'\-]+(?:-[A-Z][a-z'\-]+)?) ([A-Z]{1,3})\.?$/;
  const guests=guestsM?uniq(guestsM[1].split(',').map(s=>(s.trim().match(nameTail)||[])[0]).filter(Boolean).map(voucherName)):[];
  const rooms=(text.match(/(\d+)\s+Rooms?\s+x\s+(\d+)\s+Nights?/i)||[]).slice(1);

  // Establishment = largest text on the page that isn't the agency or the voucher title
  const skip=/voucher|izani|embassy|vat reg|booking references|client details|services required|dates & times|payment|special instructions/i;
  let est='',address=[],estIdx=-1;
  if(items&&items.length){
    const cands=items.filter(i=>i.str.trim().length>2&&!skip.test(i.str));
    const top=cands.sort((a,b)=>b.h-a.h)[0];
    if(top){
      est=top.str.trim();
      // Address: lines directly under the name, in the same column, before the next heading
      address=items.filter(i=>Math.abs(i.x-top.x)<20&&i.y<top.y&&top.y-i.y<70&&!skip.test(i.str)&&!/^(Tel|Contact|Email|Fax)\b/i.test(i.str.trim()))
        .sort((a,b)=>b.y-a.y).map(i=>i.str.trim());
    }
  }
  if(!est){
    const vi=lines.findIndex(l=>/Accommodation Voucher/i.test(l));
    for(let i=vi+1;vi>=0&&i<lines.length;i++){
      const l=lines[i].trim();
      if(!l||/^(vat reg no|n\/a)$/i.test(l)||skip.test(l))continue;
      est=l;estIdx=i;break;
    }
    for(let i=estIdx+1;estIdx>=0&&i<lines.length&&address.length<3;i++){
      const l=lines[i].trim();
      if(/^(Tel|Contact|Email|Fax)\b/i.test(l)||skip.test(l))break;
      if(l)address.push(l);
    }
  }
  // Supplier phone / contact / email: the ones after the establishment name (the agency's own Tel comes first)
  const after=est&&text.includes(est)?text.slice(text.indexOf(est)):text;
  const phone=(after.match(/\bTel\s*:\s*([+\d][\d ()+\-]{6,}\d)/i)||[])[1]||'';
  const contact=(after.match(/\bContact\s*:\s*([A-Za-z][A-Za-z .'\-]{0,40}?)(?=\s+(?:Email|Tel|Fax|Booking|$))/i)||[])[1]||'';
  const email=(after.match(/\bEmail\s*:\s*([^\s@]+@[^\s@]+\.[A-Za-z.]+)/i)||[])[1]||'';
  return{establishment:est,address:address.join(', '),phone:phone.trim(),contact:contact.trim(),email,
    checkIn:ci.date,checkInTime:ci.time,checkOut:co.date,checkOutTime:co.time,guests,commNum:order,
    rooms:rooms.length?`${rooms[0]} room${rooms[0]==='1'?'':'s'} × ${rooms[1]} night${rooms[1]==='1'?'':'s'}`:''};
}

export function parseTravelDoc({lines=[],items=null}={}){
  const clean=lines.map(l=>String(l).replace(/\u00a0/g,' ').trim()).filter(Boolean);
  const text=clean.join(' ').replace(/\s+/g,' ');
  const isAccom=/Accommodation Voucher|Check[ -]?In\s*:/i.test(text);
  const flights=isAccom?[]:parseFlights(text);
  const accom=isAccom?parseAccom(text,clean,items):null;
  return{kind:accom?'accom':flights.length?'flight':'unknown',flights,accom};
}
