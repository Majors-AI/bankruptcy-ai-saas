import { useState, useRef, useMemo, useEffect } from "react";
import { supabase } from "./lib/supabase";
import IntakeChatbot from "./components/IntakeChatbot";
import irsData from "./data/irs_standards_az_wa_ca_(1).json";

const US_STATES = ["Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming","District of Columbia"];
const SECTIONS  = ["Filing Type","Household","Income","Real Property","Personal Property","Expenses","Debts","Financial History","Personal Injury Screening","Review & Submit"];

const COUNTIES_BY_STATE = {
  "Alabama":    ["Autauga","Baldwin","Barbour","Bibb","Blount","Bullock","Butler","Calhoun","Chambers","Cherokee","Chilton","Choctaw","Clarke","Clay","Cleburne","Coffee","Colbert","Conecuh","Coosa","Covington","Crenshaw","Cullman","Dale","Dallas","DeKalb","Elmore","Escambia","Etowah","Fayette","Franklin","Geneva","Greene","Hale","Henry","Houston","Jackson","Jefferson","Lamar","Lauderdale","Lawrence","Lee","Limestone","Lowndes","Macon","Madison","Marengo","Marion","Marshall","Mobile","Monroe","Montgomery","Morgan","Perry","Pickens","Pike","Randolph","Russell","Shelby","St. Clair","Sumter","Talladega","Tallapoosa","Tuscaloosa","Walker","Washington","Wilcox","Winston"],
  "Alaska":     ["Aleutians East","Aleutians West","Anchorage","Bethel","Bristol Bay","Chugach","Copper River","Denali","Dillingham","Fairbanks North Star","Haines","Hoonah-Angoon","Juneau","Kenai Peninsula","Ketchikan Gateway","Kodiak Island","Kusilvak","Lake and Peninsula","Matanuska-Susitna","Nome","North Slope","Northwest Arctic","Petersburg","Prince of Wales-Hyder","Sitka","Skagway","Southeast Fairbanks","Wrangell","Yakutat","Yukon-Koyukuk"],
  "Arizona":    ["Apache","Cochise","Coconino","Gila","Graham","Greenlee","La Paz","Maricopa","Mohave","Navajo","Pima","Pinal","Santa Cruz","Yavapai","Yuma"],
  "Arkansas":   ["Arkansas","Ashley","Baxter","Benton","Boone","Bradley","Calhoun","Carroll","Chicot","Clark","Clay","Cleburne","Cleveland","Columbia","Conway","Craighead","Crawford","Crittenden","Cross","Dallas","Desha","Drew","Faulkner","Franklin","Fulton","Garland","Grant","Greene","Hempstead","Hot Spring","Howard","Independence","Izard","Jackson","Jefferson","Johnson","Lafayette","Lawrence","Lee","Lincoln","Little River","Logan","Lonoke","Madison","Marion","Miller","Mississippi","Monroe","Montgomery","Nevada","Newton","Ouachita","Perry","Phillips","Pike","Poinsett","Polk","Pope","Prairie","Pulaski","Randolph","St. Francis","Saline","Scott","Searcy","Sebastian","Sevier","Sharp","Stone","Union","Van Buren","Washington","White","Woodruff","Yell"],
  "California": ["Alameda","Alpine","Amador","Butte","Calaveras","Colusa","Contra Costa","Del Norte","El Dorado","Fresno","Glenn","Humboldt","Imperial","Inyo","Kern","Kings","Lake","Lassen","Los Angeles","Madera","Marin","Mariposa","Mendocino","Merced","Modoc","Mono","Monterey","Napa","Nevada","Orange","Placer","Plumas","Riverside","Sacramento","San Benito","San Bernardino","San Diego","San Francisco","San Joaquin","San Luis Obispo","San Mateo","Santa Barbara","Santa Clara","Santa Cruz","Shasta","Sierra","Siskiyou","Solano","Sonoma","Stanislaus","Sutter","Tehama","Trinity","Tulare","Tuolumne","Ventura","Yolo","Yuba"],
  "Colorado":   ["Adams","Alamosa","Arapahoe","Archuleta","Baca","Bent","Boulder","Broomfield","Chaffee","Cheyenne","Clear Creek","Conejos","Costilla","Crowley","Custer","Delta","Denver","Dolores","Douglas","Eagle","El Paso","Elbert","Fremont","Garfield","Gilpin","Grand","Gunnison","Hinsdale","Huerfano","Jackson","Jefferson","Kiowa","Kit Carson","La Plata","Lake","Larimer","Las Animas","Lincoln","Logan","Mesa","Mineral","Moffat","Montezuma","Montrose","Morgan","Otero","Ouray","Park","Phillips","Pitkin","Prowers","Pueblo","Rio Blanco","Rio Grande","Routt","Saguache","San Juan","San Miguel","Sedgwick","Summit","Teller","Washington","Weld","Yuma"],
  "Connecticut":["Fairfield","Hartford","Litchfield","Middlesex","New Haven","New London","Tolland","Windham"],
  "Georgia":    ["Appling","Atkinson","Bacon","Baker","Baldwin","Banks","Barrow","Bartow","Ben Hill","Berrien","Bibb","Bleckley","Brantley","Brooks","Bryan","Bulloch","Burke","Butts","Calhoun","Camden","Candler","Carroll","Catoosa","Charlton","Chatham","Chattahoochee","Chattooga","Cherokee","Clarke","Clay","Clayton","Clinch","Cobb","Coffee","Colquitt","Columbia","Cook","Coweta","Crawford","Crisp","Dade","Dawson","Decatur","DeKalb","Dodge","Dooly","Dougherty","Douglas","Early","Echols","Effingham","Elbert","Emanuel","Evans","Fannin","Fayette","Floyd","Forsyth","Franklin","Fulton","Gilmer","Glascock","Glynn","Gordon","Grady","Greene","Gwinnett","Habersham","Hall","Hancock","Haralson","Harris","Hart","Heard","Henry","Houston","Irwin","Jackson","Jasper","Jeff Davis","Jefferson","Jenkins","Johnson","Jones","Lamar","Lanier","Laurens","Lee","Liberty","Lincoln","Long","Lowndes","Lumpkin","McDuffie","McIntosh","Macon","Madison","Marion","Meriwether","Miller","Mitchell","Monroe","Montgomery","Morgan","Murray","Muscogee","Newton","Oconee","Oglethorpe","Paulding","Peach","Pickens","Pierce","Pike","Polk","Pulaski","Putnam","Quitman","Rabun","Randolph","Richmond","Rockdale","Schley","Screven","Seminole","Spalding","Stephens","Stewart","Sumter","Talbot","Taliaferro","Tattnall","Taylor","Telfair","Terrell","Thomas","Tift","Toombs","Towns","Treutlen","Troup","Turner","Twiggs","Union","Upson","Walker","Walton","Ware","Warren","Washington","Wayne","Webster","Wheeler","White","Whitfield","Wilcox","Wilkes","Wilkinson","Worth"],
  "Idaho":      ["Ada","Adams","Bannock","Bear Lake","Benewah","Bingham","Blaine","Boise","Bonner","Bonneville","Boundary","Butte","Camas","Canyon","Caribou","Cassia","Clark","Clearwater","Custer","Elmore","Franklin","Fremont","Gem","Gooding","Idaho","Jefferson","Jerome","Kootenai","Latah","Lemhi","Lewis","Lincoln","Madison","Minidoka","Nez Perce","Oneida","Owyhee","Payette","Power","Shoshone","Teton","Twin Falls","Valley","Washington"],
  "Illinois":   ["Adams","Alexander","Bond","Boone","Brown","Bureau","Calhoun","Carroll","Cass","Champaign","Christian","Clark","Clay","Clinton","Coles","Cook","Crawford","Cumberland","DeKalb","DeWitt","Douglas","DuPage","Edgar","Edwards","Effingham","Fayette","Ford","Franklin","Fulton","Gallatin","Greene","Grundy","Hamilton","Hancock","Hardin","Henderson","Henry","Iroquois","Jackson","Jasper","Jefferson","Jersey","Jo Daviess","Johnson","Kane","Kankakee","Kendall","Knox","Lake","LaSalle","Lawrence","Lee","Livingston","Logan","Macon","Macoupin","Madison","Marion","Marshall","Mason","Massac","McDonough","McHenry","McLean","Menard","Mercer","Monroe","Montgomery","Morgan","Moultrie","Ogle","Peoria","Perry","Piatt","Pike","Pope","Pulaski","Putnam","Randolph","Richland","Rock Island","St. Clair","Saline","Sangamon","Schuyler","Scott","Shelby","Stark","Stephenson","Tazewell","Union","Vermilion","Wabash","Warren","Washington","Wayne","White","Whiteside","Will","Williamson","Winnebago","Woodford"],
  "Kentucky":   ["Adair","Allen","Anderson","Ballard","Barren","Bath","Bell","Boone","Bourbon","Boyd","Boyle","Bracken","Breathitt","Breckinridge","Bullitt","Butler","Caldwell","Calloway","Campbell","Carlisle","Carroll","Carter","Casey","Christian","Clark","Clay","Clinton","Crittenden","Cumberland","Daviess","Edmonson","Elliott","Estill","Fayette","Fleming","Floyd","Franklin","Fulton","Gallatin","Garrard","Grant","Graves","Grayson","Green","Greenup","Hancock","Hardin","Harlan","Harrison","Hart","Henderson","Henry","Hickman","Hopkins","Jackson","Jefferson","Jessamine","Johnson","Kenton","Knott","Knox","Larue","Laurel","Lawrence","Lee","Leslie","Letcher","Lewis","Lincoln","Livingston","Logan","Lyon","Madison","Magoffin","Marion","Marshall","Martin","Mason","McCracken","McCreary","McLean","Meade","Menifee","Mercer","Metcalfe","Monroe","Montgomery","Morgan","Muhlenberg","Nelson","Nicholas","Ohio","Oldham","Owen","Owsley","Pendleton","Perry","Pike","Powell","Pulaski","Robertson","Rockcastle","Rowan","Russell","Scott","Shelby","Simpson","Spencer","Taylor","Todd","Trigg","Trimble","Union","Warren","Washington","Wayne","Webster","Whitley","Wolfe","Woodford"],
  "Louisiana":  ["Acadia","Allen","Ascension","Assumption","Avoyelles","Beauregard","Bienville","Bossier","Caddo","Calcasieu","Caldwell","Cameron","Catahoula","Claiborne","Concordia","De Soto","East Baton Rouge","East Carroll","East Feliciana","Evangeline","Franklin","Grant","Iberia","Iberville","Jackson","Jefferson","Jefferson Davis","La Salle","Lafayette","Lafourche","Lincoln","Livingston","Madison","Morehouse","Natchitoches","Orleans","Ouachita","Plaquemines","Pointe Coupee","Rapides","Red River","Richland","Sabine","St. Bernard","St. Charles","St. Helena","St. James","St. John the Baptist","St. Landry","St. Martin","St. Mary","St. Tammany","Tangipahoa","Tensas","Terrebonne","Union","Vermilion","Vernon","Washington","Webster","West Baton Rouge","West Carroll","West Feliciana","Winn"],
  "Michigan":   ["Alcona","Alger","Allegan","Alpena","Antrim","Arenac","Baraga","Barry","Bay","Benzie","Berrien","Branch","Calhoun","Cass","Charlevoix","Cheboygan","Chippewa","Clare","Clinton","Crawford","Delta","Dickinson","Eaton","Emmet","Genesee","Gladwin","Gogebic","Grand Traverse","Gratiot","Hillsdale","Houghton","Huron","Ingham","Ionia","Iosco","Iron","Isabella","Jackson","Kalamazoo","Kalkaska","Kent","Keweenaw","Lake","Lapeer","Leelanau","Lenawee","Livingston","Luce","Mackinac","Macomb","Manistee","Marquette","Mason","Mecosta","Menominee","Midland","Missaukee","Monroe","Montcalm","Montmorency","Muskegon","Newaygo","Oakland","Oceana","Ogemaw","Ontonagon","Osceola","Oscoda","Otsego","Ottawa","Presque Isle","Roscommon","Saginaw","Sanilac","Schoolcraft","Shiawassee","St. Clair","St. Joseph","Tuscola","Van Buren","Washtenaw","Wayne","Wexford"],
  "Nevada":     ["Carson City","Churchill","Clark","Douglas","Elko","Esmeralda","Eureka","Humboldt","Lander","Lincoln","Lyon","Mineral","Nye","Pershing","Storey","Washoe","White Pine"],
  "New Mexico":  ["Bernalillo","Catron","Chaves","Cibola","Colfax","Curry","De Baca","Dona Ana","Eddy","Grant","Guadalupe","Harding","Hidalgo","Lea","Lincoln","Los Alamos","Luna","McKinley","Mora","Otero","Quay","Rio Arriba","Roosevelt","Sandoval","San Juan","San Miguel","Santa Fe","Sierra","Socorro","Taos","Torrance","Union","Valencia"],
  "Ohio":       ["Adams","Allen","Ashland","Ashtabula","Athens","Auglaize","Belmont","Brown","Butler","Carroll","Champaign","Clark","Clermont","Clinton","Columbiana","Coshocton","Crawford","Cuyahoga","Darke","Defiance","Delaware","Erie","Fairfield","Fayette","Franklin","Fulton","Gallia","Geauga","Greene","Guernsey","Hamilton","Hancock","Hardin","Harrison","Henry","Highland","Hocking","Holmes","Huron","Jackson","Jefferson","Knox","Lake","Lawrence","Licking","Logan","Lorain","Lucas","Madison","Mahoning","Marion","Medina","Meigs","Mercer","Miami","Monroe","Montgomery","Morgan","Morrow","Muskingum","Noble","Ottawa","Paulding","Perry","Pickaway","Pike","Portage","Preble","Putnam","Richland","Ross","Sandusky","Scioto","Seneca","Shelby","Stark","Summit","Trumbull","Tuscarawas","Union","Van Wert","Vinton","Warren","Washington","Wayne","Williams","Wood","Wyandot"],
  "Oregon":      ["Baker","Benton","Clackamas","Clatsop","Columbia","Coos","Crook","Curry","Deschutes","Douglas","Gilliam","Grant","Harney","Hood River","Jackson","Jefferson","Josephine","Klamath","Lake","Lane","Lincoln","Linn","Malheur","Marion","Morrow","Multnomah","Polk","Sherman","Tillamook","Umatilla","Union","Wallowa","Wasco","Washington","Wheeler","Yamhill"],
  "Utah":       ["Beaver","Box Elder","Cache","Carbon","Daggett","Davis","Duchesne","Emery","Garfield","Grand","Iron","Juab","Kane","Millard","Morgan","Piute","Rich","Salt Lake","San Juan","Sanpete","Sevier","Summit","Tooele","Uintah","Utah","Wasatch","Washington","Wayne","Weber"],
  "Tennessee":  ["Anderson","Bedford","Benton","Bledsoe","Blount","Bradley","Campbell","Cannon","Carroll","Carter","Cheatham","Chester","Claiborne","Clay","Cocke","Coffee","Crockett","Cumberland","Davidson","Decatur","DeKalb","Dickson","Dyer","Fayette","Fentress","Franklin","Gibson","Giles","Grainger","Greene","Grundy","Hamblen","Hamilton","Hancock","Hardeman","Hardin","Hawkins","Haywood","Henderson","Henry","Hickman","Houston","Humphreys","Jackson","Jefferson","Johnson","Knox","Lake","Lauderdale","Lawrence","Lewis","Lincoln","Loudon","McMinn","McNairy","Macon","Madison","Marion","Marshall","Maury","Meigs","Monroe","Montgomery","Moore","Morgan","Obion","Overton","Perry","Pickett","Polk","Putnam","Rhea","Roane","Robertson","Rutherford","Scott","Sequatchie","Sevier","Shelby","Smith","Stewart","Sullivan","Sumner","Tipton","Trousdale","Unicoi","Union","Van Buren","Warren","Washington","Wayne","Weakley","White","Williamson","Wilson"],
  "Texas":      ["Anderson","Andrews","Angelina","Aransas","Archer","Armstrong","Atascosa","Austin","Bailey","Bandera","Bastrop","Baylor","Bee","Bell","Bexar","Blanco","Borden","Bosque","Bowie","Brazoria","Brazos","Brewster","Briscoe","Brooks","Brown","Burleson","Burnet","Caldwell","Calhoun","Callahan","Cameron","Camp","Carson","Cass","Castro","Chambers","Cherokee","Childress","Clay","Cochran","Coke","Coleman","Collin","Collingsworth","Colorado","Comal","Comanche","Concho","Cooke","Coryell","Cottle","Crane","Crockett","Crosby","Culberson","Dallam","Dallas","Dawson","Deaf Smith","Delta","Denton","DeWitt","Dickens","Dimmit","Donley","Duval","Eastland","Ector","Edwards","Ellis","El Paso","Erath","Falls","Fannin","Fayette","Fisher","Floyd","Foard","Fort Bend","Franklin","Freestone","Frio","Gaines","Galveston","Garza","Gillespie","Glasscock","Goliad","Gonzales","Gray","Grayson","Gregg","Grimes","Guadalupe","Hale","Hall","Hamilton","Hansford","Hardeman","Hardin","Harris","Harrison","Hartley","Haskell","Hays","Hemphill","Henderson","Hidalgo","Hill","Hockley","Hood","Hopkins","Houston","Howard","Hudspeth","Hunt","Hutchinson","Irion","Jack","Jackson","Jasper","Jeff Davis","Jefferson","Jim Hogg","Jim Wells","Johnson","Jones","Karnes","Kaufman","Kendall","Kenedy","Kent","Kerr","Kimble","King","Kinney","Kleberg","Knox","Lamar","Lamb","Lampasas","La Salle","Lavaca","Lee","Leon","Liberty","Limestone","Lipscomb","Live Oak","Llano","Loving","Lubbock","Lynn","Madison","Marion","Martin","Mason","Matagorda","Maverick","McCulloch","McLennan","McMullen","Medina","Menard","Midland","Milam","Mills","Mitchell","Montague","Montgomery","Moore","Morris","Motley","Nacogdoches","Navarro","Newton","Nolan","Nueces","Ochiltree","Oldham","Orange","Palo Pinto","Panola","Parker","Parmer","Pecos","Polk","Potter","Presidio","Rains","Randall","Reagan","Real","Red River","Reeves","Refugio","Roberts","Robertson","Rockwall","Runnels","Rusk","Sabine","San Augustine","San Jacinto","San Patricio","San Saba","Schleicher","Scurry","Shackelford","Shelby","Sherman","Smith","Somervell","Starr","Stephens","Sterling","Stonewall","Sutton","Swisher","Tarrant","Taylor","Terrell","Terry","Throckmorton","Titus","Tom Green","Travis","Trinity","Tyler","Upshur","Upton","Uvalde","Val Verde","Van Zandt","Victoria","Walker","Waller","Ward","Washington","Webb","Wharton","Wheeler","Wichita","Wilbarger","Willacy","Williamson","Wilson","Winkler","Wise","Wood","Yoakum","Young","Zapata","Zavala"],
  "Washington": ["Adams","Asotin","Benton","Chelan","Clallam","Clark","Columbia","Cowlitz","Douglas","Ferry","Franklin","Garfield","Grant","Grays Harbor","Island","Jefferson","King","Kitsap","Kittitas","Klickitat","Lewis","Lincoln","Mason","Okanogan","Pacific","Pend Oreille","Pierce","San Juan","Skagit","Skamania","Snohomish","Spokane","Stevens","Thurston","Wahkiakum","Walla Walla","Whatcom","Whitman","Yakima"],
};

const MEDIAN_INCOME = {
  "Alabama":       { 1:62672,  2:75465,  3:90321,  4:104003, extra:11100 },
  "Alaska":        { 1:83617,  2:109882, 3:109882, 4:138492, extra:11100 },
  "Arizona":       { 1:72039,  2:86745,  3:102274, 4:118067, extra:11100 },
  "Arkansas":      { 1:56923,  2:71742,  3:80218,  4:94586,  extra:11100 },
  "California":    { 1:77221,  2:100161, 3:113553, 4:135505, extra:11100 },
  "Colorado":      { 1:85685,  2:106890, 3:127495, 4:149566, extra:11100 },
  "Connecticut":   { 1:82141,  2:103501, 3:131022, 4:155834, extra:11100 },
  "Delaware":      { 1:67733,  2:92445,  3:108420, 4:128854, extra:11100 },
  "Florida":       { 1:68085,  2:84385,  3:95039,  4:111819, extra:11100 },
  "Georgia":       { 1:66722,  2:82787,  3:98877,  4:120315, extra:11100 },
  "Hawaii":        { 1:83068,  2:103479, 3:120289, 4:138536, extra:11100 },
  "Idaho":         { 1:71531,  2:83951,  3:95859,  4:116594, extra:11100 },
  "Illinois":      { 1:71304,  2:91526,  3:110712, 4:134366, extra:11100 },
  "Indiana":       { 1:62808,  2:79884,  3:93175,  4:112691, extra:11100 },
  "Iowa":          { 1:65883,  2:86523,  3:101463, 4:122826, extra:11100 },
  "Kansas":        { 1:67423,  2:85199,  3:101189, 4:122741, extra:11100 },
  "Kentucky":      { 1:60071,  2:71998,  3:83027,  4:108637, extra:11100 },
  "Louisiana":     { 1:57923,  2:70493,  3:82433,  4:100971, extra:11100 },
  "Maine":         { 1:73946,  2:88126,  3:104083, 4:128204, extra:11100 },
  "Maryland":      { 1:84699,  2:111673, 3:132464, 4:161913, extra:11100 },
  "Massachusetts": { 1:85941,  2:109818, 3:135837, 4:173947, extra:11100 },
  "Michigan":      { 1:65625,  2:81293,  3:100797, 4:134254, extra:11100 },
  "Minnesota":     { 1:75704,  2:95807,  3:123244, 4:146039, extra:11100 },
  "Mississippi":   { 1:52594,  2:68525,  3:80722,  4:94965,  extra:11100 },
  "Missouri":      { 1:63306,  2:79971,  3:97658,  4:115491, extra:11100 },
  "Montana":       { 1:69482,  2:88107,  3:100637, 4:118578, extra:11100 },
  "Nebraska":      { 1:65206,  2:88402,  3:100754, 4:121867, extra:11100 },
  "Nevada":        { 1:65868,  2:85860,  3:99032,  4:111184, extra:11100 },
  "New Hampshire": { 1:85049,  2:106521, 3:137902, 4:151224, extra:11100 },
  "New Jersey":    { 1:84938,  2:104138, 3:133620, 4:163817, extra:11100 },
  "New Mexico":    { 1:64537,  2:77534,  3:85784,  4:96074,  extra:11100 },
  "New York":      { 1:71393,  2:90520,  3:112616, 4:135475, extra:11100 },
  "North Carolina":{ 1:65396,  2:82221,  3:98932,  4:113744, extra:11100 },
  "North Dakota":  { 1:71683,  2:93882,  3:103951, 4:134254, extra:11100 },
  "Ohio":          { 1:64541,  2:81578,  3:99876,  4:120531, extra:11100 },
  "Oklahoma":      { 1:59611,  2:75229,  3:84618,  4:99188,  extra:11100 },
  "Oregon":        { 1:77061,  2:91268,  3:113736, 4:136434, extra:11100 },
  "Pennsylvania":  { 1:70378,  2:85290,  3:107327, 4:132379, extra:11100 },
  "Rhode Island":  { 1:75662,  2:96205,  3:116357, 4:133954, extra:11100 },
  "South Carolina":{ 1:63140,  2:81614,  3:93219,  4:113332, extra:11100 },
  "South Dakota":  { 1:67415,  2:87598,  3:88297,  4:127386, extra:11100 },
  "Tennessee":     { 1:62339,  2:80722,  3:95011,  4:106775, extra:11100 },
  "Texas":         { 1:65123,  2:84491,  3:96728,  4:114938, extra:11100 },
  "Utah":          { 1:85644,  2:93302,  3:109860, 4:128363, extra:11100 },
  "Vermont":       { 1:70603,  2:94477,  3:111150, 4:134056, extra:11100 },
  "Virginia":      { 1:76479,  2:98577,  3:120001, 4:141113, extra:11100 },
  "Washington":    { 1:86314,  2:104354, 3:128369, 4:152553, extra:11100 },
  "West Virginia": { 1:62270,  2:66833,  3:89690,  4:91270,  extra:11100 },
  "Wisconsin":     { 1:69343,  2:87938,  3:105734, 4:129964, extra:11100 },
  "Wyoming":       { 1:69906,  2:88156,  3:95951,  4:107469, extra:11100 },
};
const MEDIAN_DATE = "November 1, 2025";
const getMedian = (state, hhSize) => {
  const t = MEDIAN_INCOME[state];
  if (!t) return null;
  return hhSize <= 4 ? (t[hhSize] || t[4]) : t[4] + (hhSize - 4) * t.extra;
};

const EXEMPTIONS = {
  federal: {
    label:"Federal (11 U.S.C. §522(d))",
    homestead:{ind:31575,joint:63150},
    vehicle:{ind:5025,joint:10050},
    household:{ind:16850,joint:33700,note:"$800/item max"},
    jewelry:{ind:2125,joint:4250},
    wildcard:{ind:1675,joint:3350,note:"+up to $15,800 unused homestead"},
    tools:{ind:3175,joint:6350},
    lifeIns:{ind:16850,joint:33700},
    retirement:"Unlimited (ERISA-qualified plans); IRA cap §522(n)",
    personalInjury:{ind:31575,joint:63150},
    note:"Available in states that have not opted out of federal exemptions."
  },
  AZ:{
    label:"Arizona",
    homestead:{ind:437600,joint:437600,note:"One owner-occupied residence. Ariz. Rev. Stat. § 33-1101(A)"},
    vehicle:{ind:16500,joint:33000,note:"One motor vehicle. Ariz. Rev. Stat. § 33-1125(8)"},
    household:{ind:16500,joint:33000,note:"Household furniture, furnishings, goods, consumer electronics. Ariz. Rev. Stat. § 33-1123"},
    jewelry:{ind:2000,joint:4000,note:"Engagement and wedding rings. Ariz. Rev. Stat. § 33-1125(4)"},
    tools:{ind:5000,joint:10000,note:"Tools of trade. Ariz. Rev. Stat. § 33-1130(1)"},
    lifeIns:"100% — proceeds and cash value. Ariz. Rev. Stat. § 20-1131(A)",
    retirement:"Unlimited — qualified retirement plans. Ariz. Rev. Stat. § 33-1126(B)",
    wages:"Greater of 90% or 60 times minimum hourly wage. Ariz. Rev. Stat. § 33-1131(B)",
    note:"AZ exemptions limited to residents.",
    residentsOnly:true, optOut:true
  },
  CA_703:{
    label:"California §703 (C.C.P. §703.140)",
    homestead:{ind:36750,joint:36750,note:"Inflation-adjusted 2025"},
    vehicle:{ind:8625,joint:8625},
    household:{ind:null,joint:null,note:"No dollar limit; $925/item max"},
    jewelry:{ind:2175,joint:2175},
    wildcard:{ind:1950,joint:1950,note:"+unused homestead (up to $36,750)"},
    tools:{ind:10950,joint:10950},
    lifeIns:{ind:19625,joint:19625},
    retirement:"Unlimited",
    personalInjury:{ind:36750,joint:36750},
    note:"California has opted out of the federal exemption system. §703 and §704 are California's two exemption sets — only one may be used.",
    optOut:true
  },
  CA_704:{
    label:"California §704 (C.C.P. §704.xxx)",
    homestead:{ind:746375,joint:746375,note:"County-specific — equals prior calendar year county median single-family home sale price. Floor ~$373,188 / cap $746,375."},
    homesteadByCounty:{
      "Alameda":746375,"Alpine":746375,"Contra Costa":746375,"Los Angeles":746375,"Marin":746375,
      "Mono":746375,"Monterey":746375,"Napa":746375,"Orange":746375,"San Diego":746375,
      "San Francisco":746375,"San Luis Obispo":746375,"San Mateo":746375,"Santa Barbara":746375,
      "Santa Clara":746375,"Santa Cruz":746375,"Ventura":746375,
      "El Dorado":635000,"Placer":660000,"San Benito":715000,"Sonoma":735000,"Yolo":590000,
      "Nevada":575000,"Solano":555000,"Sacramento":535000,"Mendocino":535000,"Riverside":545000,
      "San Joaquin":515000,"Stanislaus":460000,"San Bernardino":470000,"Amador":455000,
      "Calaveras":435000,"Tuolumne":395000,"Sutter":395000,"Humboldt":390000,"Inyo":390000,
      "Butte":385000,"Fresno":385000,"Kern":378000,"Madera":383000,"Merced":383000,
      "Shasta":380000,"Yuba":385000,
      "Colusa":373188,"Del Norte":373188,"Glenn":373188,"Imperial":373188,"Kings":373188,
      "Lake":373188,"Lassen":373188,"Mariposa":373188,"Modoc":373188,"Plumas":373188,
      "Sierra":373188,"Siskiyou":373188,"Tehama":373188,"Trinity":373188,"Tulare":373188,
    },
    vehicle:{ind:8625,joint:8625},
    household:{ind:null,joint:null,note:"Reasonable amount — no stated cap"},
    jewelry:{ind:10950,joint:10950},
    tools:{ind:10950,joint:10950},
    lifeIns:{ind:17525,joint:35050},
    retirement:"Unlimited (public); extent necessary for support (private/IRA)",
    note:"Best for homeowners with significant equity. CA opted OUT of federal. Choose §703 OR §704.",
    optOut:true
  },
  CO:{
    label:"Colorado",
    homestead:{ind:250000,joint:250000,note:"$350,000 if elderly/disabled. Colo. Rev. Stat. § 38-41-201"},
    vehicle:{ind:15000,joint:30000,note:"Two-vehicle maximum. Colo. Rev. Stat. § 13-54-102(1)(j)"},
    household:{ind:6000,joint:12000,note:"Colo. Rev. Stat. § 13-54-102(1)(e)"},
    jewelry:{ind:2500,joint:5000},
    tools:{ind:60000,joint:120000,note:"Primary occupation tools. Colo. Rev. Stat. § 13-54-102(1)(i)"},
    lifeIns:{ind:250000,joint:500000},
    retirement:"100% except support obligations. Colo. Rev. Stat. § 13-54-102(1)(s)",
    wages:"Greater of: 80%, 40x federal minimum wage, or 40x state minimum. Colo. Rev. Stat. § 13-54-104(2)(a)",
    note:"CO exemptions limited to residents.",
    residentsOnly:true
  },
  FL:{
    label:"Florida",
    homestead:{ind:"Unlimited",joint:"Unlimited",note:"1/2 acre urban, 160 acres rural. Fla. Const. art. X, § 4"},
    vehicle:{ind:1000,joint:2000},
    household:{ind:1000,joint:2000},
    wages:{ind:"100%",joint:"100%",note:"Head of household — unlimited; others 75%."},
    retirement:"Unlimited — qualified plans, IRAs.",
    lifeIns:"100% — cash surrender value.",
    note:"FL exemptions limited to residents.",
    residentsOnly:true, optOut:true
  },
  IL:{
    label:"Illinois",
    homestead:{ind:15000,joint:30000,note:"735 ILCS 5/12-901"},
    vehicle:{ind:2400,joint:4800},
    household:{ind:4000,joint:8000},
    wildcard:{ind:4000,joint:8000},
    tools:{ind:1500,joint:3000},
    retirement:"Unlimited. 735 ILCS 5/12-1006",
    note:"IL allows non-residents.",
    allowsNonResidents:true
  },
  NM:{
    label:"New Mexico",
    homestead:{ind:150000,joint:300000,note:"N.M. Stat. Ann. § 42-10-9(B)"},
    vehicle:{ind:10000,joint:20000},
    household:{ind:75000,joint:150000},
    jewelry:{ind:5000,joint:10000},
    tools:{ind:15000,joint:30000},
    wildcard:{ind:15000,joint:30000},
    lifeIns:"100%. N.M. Stat. Ann. § 42-10-3",
    retirement:"Unlimited. N.M. Stat. Ann. § 42-10-1",
    note:"NM has not opted out of federal exemptions.",
    allowsNonResidents:true
  },
  OR:{
    label:"Oregon",
    homestead:{ind:154200,joint:308400,note:"ORS §§ 18.395, 18.402"},
    vehicle:{ind:10000,joint:20000},
    household:{ind:3000,joint:3000},
    jewelry:{ind:1800,joint:3600},
    wildcard:{ind:400,joint:800},
    tools:{ind:5000,joint:10000},
    retirement:"Unlimited. ORS §§ 18.358; 18.348(2)",
    wages:"75% of disposable earnings. ORS §§ 18.385",
    note:"OR exemptions limited to residents.",
    residentsOnly:true, optOut:true
  },
  TX:{
    label:"Texas",
    homestead:{ind:"Unlimited",joint:"Unlimited",note:"200 acres rural, 10 acres urban. Tex. Const. art. XVI, §§ 50, 51"},
    vehicle:{ind:"1 per licensed adult",joint:"1 per licensed adult",note:"Within $100,000/$50,000 aggregate."},
    household:{ind:100000,joint:100000,note:"$50,000 single adult. Aggregate of all personal property."},
    lifeIns:"100%. Tex. Ins. Code § 1108.051",
    retirement:"Unlimited. Tex. Prop. Code § 42.0021",
    wages:"100% current wages. Tex. Const. art. XVI, § 28",
    note:"TX does NOT limit exemptions to residents.",
    allowsNonResidents:true, noOptOut:true
  },
  UT:{
    label:"Utah",
    homestead:{ind:53700,joint:107500,note:"Primary personal residence not exceeding one acre. Utah Code Ann. § 78B-5-503(2)"},
    vehicle:{ind:3000,joint:6000},
    tools:{ind:5000,joint:10000},
    lifeIns:"100%. Utah Code Ann. § 78B-5-505(1)(a)(xi)",
    retirement:"Unlimited. Utah Code Ann. § 78B-5-505(1)(a)(xiv)",
    wages:"Lesser of 75% or 30x federal minimum wage. Utah Code Ann. § 70C-7-103",
    note:"UT allows non-residents.",
    allowsNonResidents:true, optOut:true
  },
  WA:{
    label:"Washington",
    homestead:{ind:"County-specific",joint:"County-specific",note:"Varies by county. Wash. Rev. Code §§ 6.13.010"},
    homesteadByCounty:{
      "Adams":330000,"Asotin":322500,"Benton":439900,"Chelan":540000,"Clallam":499950,
      "Clark":555000,"Columbia":228125,"Cowlitz":399700,"Douglas":485905,"Ferry":199500,
      "Franklin":422813,"Garfield":225000,"Grant":352000,"Grays Harbor":330370,"Island":609890,
      "Jefferson":595281,"King":940000,"Kitsap":575281,"Kittitas":480000,"Klickitat":403250,
      "Lewis":410000,"Lincoln":225000,"Mason":440000,"Okanogan":310813,"Pacific":315000,
      "Pend Oreille":369000,"Pierce":560000,"San Juan":797500,"Skagit":592640,"Skamania":495370,
      "Snohomish":755000,"Spokane":420698,"Stevens":331585,"Thurston":530959,"Wahkiakum":356250,
      "Walla Walla":436750,"Whatcom":620231,"Whitman":334500,"Yakima":354990
    },
    vehicle:{ind:15000,joint:30000},
    household:{ind:6500,joint:13000},
    tools:{ind:15000,joint:30000},
    retirement:"Unlimited. Wash. Rev. Code § 6.15.020",
    wages:"Per Wash. Rev. Code § 6.27.150",
    note:"WA does NOT limit exemptions to residents.",
    allowsNonResidents:true, noOptOut:true
  }
};

const NON_RESIDENT_RULES = {
  Alabama:{ result:"federal", note:"AL exemptions limited to residents. Non-residents use federal §522(d)." },
  Alaska:{ result:"federal", note:"AK exemptions limited to residents." },
  Arizona:{ result:"federal", note:"AZ exemptions limited to residents. Non-residents use federal §522(d)." },
  Arkansas:{ result:"federal", note:"AR exemptions limited to residents." },
  California:{ result:"state_only", note:"CA allows non-residents. Opted out of federal for ALL. Must use CA state exemptions." },
  Colorado:{ result:"federal", note:"CO exemptions limited to residents. Non-residents use federal §522(d)." },
  Connecticut:{ result:"state_or_federal", note:"CT not limited to residents. Has not opted out." },
  Delaware:{ result:"federal", note:"DE exemptions limited to domiciliaries." },
  "District of Columbia":{ result:"federal", note:"DC exemptions limited to DC residents/workers." },
  Florida:{ result:"federal", note:"FL exemptions limited to residents. Non-residents use federal §522(d)." },
  Georgia:{ result:"federal", note:"GA exemptions limited to GA domiciliaries." },
  Hawaii:{ result:"state_or_federal", note:"HI not limited to residents. Has not opted out." },
  Idaho:{ result:"savings_clause_federal", note:"ID exemptions limited to residents. Non-residents use federal §522(d) under savings clause." },
  Illinois:{ result:"state_or_federal", note:"IL not limited to residents. Opt-out limited to residents." },
  Indiana:{ result:"federal", note:"IN exemptions limited to domiciliaries." },
  Iowa:{ result:"state_or_federal", note:"IA homestead extraterritorial; personal property limited to residents." },
  Kansas:{ result:"state_or_federal", note:"KS most personal property limited to residents." },
  Kentucky:{ result:"state_or_federal", note:"KY most personal property limited to residents." },
  Louisiana:{ result:"state_only", note:"LA allows non-residents. Opted out of federal for ALL." },
  Maine:{ result:"state_only", note:"ME allows non-residents. Opted out of federal for ALL." },
  Maryland:{ result:"savings_clause_federal", note:"MD exemptions limited to domiciliaries. Non-residents use federal §522(d) under savings clause." },
  Massachusetts:{ result:"state_or_federal", note:"MA not limited to residents. Has not opted out." },
  Michigan:{ result:"state_or_federal", note:"MI not limited to residents. Has not opted out." },
  Minnesota:{ result:"state_or_federal", note:"MN not limited to residents. Has not opted out." },
  Mississippi:{ result:"federal", note:"MS exemptions limited to residents." },
  Missouri:{ result:"state_only", note:"MO allows non-residents. Opted out of federal for ALL." },
  Montana:{ result:"savings_clause_federal", note:"MT exemptions limited to residents. Non-residents use federal §522(d) under savings clause." },
  Nebraska:{ result:"state_only", note:"NE allows non-residents. Opted out of federal for ALL." },
  Nevada:{ result:"state_or_federal", note:"NV not limited to residents. Opt-out limited to residents." },
  "New Hampshire":{ result:"state_or_federal", note:"NH not limited to residents. Has not opted out." },
  "New Jersey":{ result:"state_or_federal", note:"NJ not limited to residents. Has not opted out." },
  "New Mexico":{ result:"state_or_federal", note:"NM some exemptions limited to residents. Has not opted out." },
  "New York":{ result:"federal", note:"NY exemptions limited to domiciliaries." },
  "North Carolina":{ result:"federal", note:"NC exemptions limited to residents." },
  "North Dakota":{ result:"state_or_federal", note:"ND some exemptions limited to residents." },
  Ohio:{ result:"federal", note:"OH exemptions limited to domiciliaries." },
  Oklahoma:{ result:"federal", note:"OK exemptions limited to residents." },
  Oregon:{ result:"federal", note:"OR exemptions limited to residents." },
  Pennsylvania:{ result:"state_or_federal", note:"PA not limited to residents. Has not opted out." },
  "Rhode Island":{ result:"state_or_federal", note:"RI not limited to residents. Has not opted out." },
  "South Carolina":{ result:"savings_clause_federal", note:"SC exemptions limited to domiciliaries." },
  "South Dakota":{ result:"state_or_federal", note:"SD most exemptions limited to residents." },
  Tennessee:{ result:"federal", note:"TN exemptions limited to TN citizens." },
  Texas:{ result:"state_or_federal", note:"TX not limited to residents. Has not opted out." },
  Utah:{ result:"savings_clause_federal", note:"UT allows non-residents. Non-residents use federal §522(d) under savings clause." },
  Vermont:{ result:"state_or_federal", note:"VT not limited to residents. Has not opted out." },
  Virginia:{ result:"savings_clause_federal", note:"VA exemptions limited to residents." },
  Washington:{ result:"state_or_federal", note:"WA not limited to residents. Has not opted out." },
  "West Virginia":{ result:"state_or_federal", note:"WV not limited to residents." },
  Wisconsin:{ result:"federal", note:"WI exemptions limited to residents." },
  Wyoming:{ result:"savings_clause_federal", note:"WY exemptions limited to residents." },
};

const STATE_TO_EXEMPTION_KEY = {
  "Arizona":"AZ","California":"CA_703","Colorado":"CO","Florida":"FL",
  "Illinois":"IL","New Mexico":"NM","Oregon":"OR","Texas":"TX",
  "Utah":"UT","Washington":"WA"
};

const calcDomicileResult = (data) => {
  const inState730 = data.addressYears === "2+ years";
  if (inState730) {
    const exKey = STATE_TO_EXEMPTION_KEY[data.state] || null;
    return { exKey, resident:true, rule:"730-day", note:"", stateName:data.state };
  }
  const priorState = data.priorDomicileState || "";
  if (!priorState) {
    return { exKey:null, resident:false, rule:"no-prior", stateName:"",
      note:"Prior domicile state not yet entered." };
  }
  const rule = NON_RESIDENT_RULES[priorState];
  if (!rule) {
    return { exKey:null, resident:false, rule:"unknown", stateName:priorState,
      note:`${priorState} exemption data not yet in our system.` };
  }
  const exKey = STATE_TO_EXEMPTION_KEY[priorState] || null;
  return { exKey, resident:false, rule:rule.result, note:rule.note, stateName:priorState };
};

const emptySource = (id) => ({ id, sourceType:"", employerName:"", payFrequency:"", grossPerPeriod:"", netPerPeriod:"", receiveBonus:"", bonusIncludedInIncome:"", bonusGross:"", bonusNet:"", businessName:"", businessType:"", businessGrossIncome:"", businessExpenses:"", bizExpRent:"", bizExpPayroll:"", bizExpSupplies:"", bizExpEquipment:"", bizExpLicenses:"", bizExpMarketing:"", bizExpProfessional:"", bizExpInsurance:"", bizExpInventory:"", bizExpOther:"", bizExpOtherDesc:"", bizExpUseItemized:false });

const VEHICLE_TYPES = [
  "Car / Truck / SUV / Van","Motorcycle","Motorhome / RV / Travel Trailer",
  "ATV / Quad / Side-by-Side","Boat","Jet Ski / Personal Watercraft",
  "Snowmobile","Airplane / Aircraft","Helicopter","Other Titled Vehicle",
];

const emptyVehicle = (id) => ({ id, type:"", year:"", make:"", model:"", value:"", valueDate:"", valueConfirmed:false, intent:"", hasLoan:"", loanBalance:"", monthlyPayment:"", interestRate:"", lenderName:"", valuationStatus:"idle", valuationResult:null, valuationError:null, valuationOverride:false, overrideReason:"", overrideDetails:"", ownershipType:"", ownedBeforeMarriage:"", maritalFundsUsed:"", hasPrenup:"", inheritedOrGift:"", communityPropFlag:false });

const KBB_TYPES = ["Car / Truck / SUV / Van","Motorcycle","Motorhome / RV / Travel Trailer"];
const NADA_TYPES = ["ATV / Quad / Side-by-Side","Boat","Jet Ski / Personal Watercraft","Snowmobile","Airplane / Aircraft","Helicopter","Other Titled Vehicle"];
const COMMUNITY_PROPERTY_STATES = ["Arizona","California","Idaho","Louisiana","Nevada","New Mexico","Texas","Washington","Wisconsin"];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const getValuationInfo = (type) => {
  if (KBB_TYPES.includes(type)) return { label: "Look Up KBB Value", url: "https://www.kbb.com/whats-my-car-worth/", source: "Kelley Blue Book (KBB)" };
  if (NADA_TYPES.includes(type)) return { label: "Look Up NADA Value", url: "https://www.nadaguides.com/", source: "NADA Guides" };
  return null;
};

// ---------------------------------------------------------------------------
// Plaid integration
// ---------------------------------------------------------------------------

/**
 * Opens the Plaid Link flow for the given product type ("transactions" for bank
 * or "payroll" for income/payroll). Returns a promise that resolves to the
 * public_token on success or null on exit/error.
 *
 * When the Plaid JS SDK is available (loaded via <script> tag or npm), this
 * calls window.Plaid.create(). Until the SDK is wired up, it resolves to null
 * so the rest of the UI can be built and tested without a live Plaid key.
 *
 * To complete the integration:
 *   1. Load the Plaid Link JS: https://cdn.plaid.com/link/v2/stable/link-initialize.js
 *   2. Create a /functions/v1/plaid-link-token edge function that calls
 *      POST /link/token/create with your Plaid client_id + secret and returns {link_token}.
 *   3. Exchange the public_token server-side via /link/token/exchange.
 */
const openPlaidLink = async ({ product = "transactions", onSuccess, onExit } = {}) => {
  if (typeof window === "undefined" || !window.Plaid) {
    console.warn("Plaid JS SDK not loaded — skipping live link flow");
    onExit?.();
    return null;
  }
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/plaid-link-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ products: [product] }),
    });
    const { link_token, error } = await res.json();
    if (error || !link_token) throw new Error(error || "No link_token returned");
    return new Promise((resolve) => {
      const handler = window.Plaid.create({
        token: link_token,
        onSuccess: (public_token, metadata) => { onSuccess?.(public_token, metadata); resolve(public_token); },
        onExit: (err) => { onExit?.(err); resolve(null); },
      });
      handler.open();
    });
  } catch (err) {
    console.error("Plaid link error:", err);
    onExit?.(err);
    return null;
  }
};

function PlaidLinkButton({ label, icon, linked, onLink }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const handleClick = async () => {
    if (linked) return;
    setLoading(true);
    setErr(null);
    const token = await openPlaidLink({
      product: icon === "payroll" ? "payroll" : "transactions",
      onSuccess: () => onLink?.(),
      onExit: () => {},
    });
    if (!token) {
      // SDK not loaded yet — simulate success so UI can be previewed
      onLink?.();
    }
    setLoading(false);
  };

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={linked || loading}
        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border font-semibold text-sm transition-all ${
          linked
            ? "bg-green-500/10 border-green-500/30 text-green-300 cursor-default"
            : loading
            ? "bg-slate-800 border-slate-600 text-slate-400 cursor-wait"
            : "bg-slate-800/60 border-slate-600 text-slate-200 hover:border-blue-400/50 hover:bg-blue-500/5"
        }`}
      >
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${linked ? "bg-green-500/20" : "bg-slate-700"}`}>
          {linked ? (
            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
          ) : icon === "payroll" ? (
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z"/></svg>
          ) : (
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
          )}
        </span>
        <span className="flex-1 text-left">{linked ? `${label} — Connected` : loading ? "Connecting…" : label}</span>
        {!linked && !loading && (
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
        )}
      </button>
      {err && <p className="text-xs text-red-400 mt-1">{err}</p>}
    </div>
  );
}

const IRS_STANDARDS_2025 = {
  food:          { 1: 497,  2: 863,  3: 1068, 4: 1255, extra: 394 },
  housekeeping:  { 1: 45,   2: 75,   3: 82,   4: 91,   extra: 0   },
  apparel:       { 1: 93,   2: 181,  3: 188,  4: 276,  extra: 0   },
  personalCare:  { 1: 50,   2: 91,   3: 94,   4: 117,  extra: 0   },
  miscellaneous: { 1: 154,  2: 271,  3: 321,  4: 390,  extra: 0   },
};

const IRS_STANDARD_LABELS = {
  food: "Food",
  housekeeping: "Housekeeping Supplies",
  apparel: "Apparel & Services",
  personalCare: "Personal Care Products & Services",
  miscellaneous: "Miscellaneous",
};

const getIrsStandard = (category, hhSize) => {
  const row = IRS_STANDARDS_2025[category];
  if (!row) return null;
  if (hhSize <= 4) return row[hhSize] || row[4];
  return row[4] + (hhSize - 4) * (row.extra || 0);
};

const STATE_ABBR_MAP = { Arizona:'AZ', Washington:'WA', California:'CA', AZ:'AZ', WA:'WA', CA:'CA' };
const IRS_COVERED_STATES = ['Arizona','Washington','California','AZ','WA','CA'];

function getHousingAllocations(state, county, hhSize) {
  const abbr = STATE_ABBR_MAP[state];
  if (!abbr) return null;
  const stateData = irsData.housing_and_utilities[abbr];
  if (!stateData) return null;
  const countyData = stateData[county];
  if (!countyData) return null;
  const key = String(Math.min(hhSize, 5));
  const bundle = countyData[key];
  if (!bundle) return null;
  const hr = irsData.allocation_ratios.housing_and_utilities_bundle;
  return {
    bundle,
    electricHeatGas: Math.round(bundle * hr.electric_heat_gas_3a),
    waterSewerGarbage: Math.round(bundle * hr.water_sewer_garbage_3b),
    phoneInternetCable: Math.round(bundle * hr.phone_internet_cable_3c),
  };
}

function getTransportAllocations(state, county, numVehicles) {
  if (numVehicles === 0) return { bundle: 0, fuelMaintenance: 0, vehicleInsurance: 244, isTransit: true };
  const abbr = STATE_ABBR_MAP[state];
  if (!abbr) return null;
  const msaMap = irsData.msa_county_mapping[abbr];
  const msa = (msaMap && msaMap[county]) || irsData.msa_county_mapping.default;
  const opData = irsData.transportation_operating_costs.by_metro_or_region[msa];
  if (!opData) return null;
  const bundle = numVehicles >= 2 ? opData.two_cars : opData.one_car;
  const tr = irsData.allocation_ratios.transportation_operating_bundle;
  return {
    bundle,
    fuelMaintenance: Math.round(bundle * tr.fuel_maintenance_registration_line_9),
    vehicleInsurance: Math.round(bundle * tr.vehicle_insurance_line_12c),
    isTransit: false,
  };
}

const IrsExpenseField = ({ label, category, hhSize, value, onChange, overrideReason, onOverrideReasonChange, error, customStandard, customLabel }) => {
  const nationalStandard = category ? getIrsStandard(category, hhSize) : null;
  const standard = customStandard !== undefined && customStandard !== null ? customStandard : nationalStandard;
  const numVal = parseFloat(value) || 0;
  const isSkipped = value === "0";
  const overLimit = !isSkipped && standard !== null && numVal > standard;
  const isAutoFilled = standard !== null && value === String(standard);
  const stdLabel = customLabel || (category ? `${hhSize}-person household (IRS National Standard)` : null);

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <label className="block text-xs font-semibold uppercase tracking-widest text-amber-400">{label}</label>
          <span className="text-xs font-medium text-slate-400 bg-slate-700/60 border border-slate-600 px-1.5 py-0.5 rounded-md leading-none">Monthly</span>
        </div>
        <div className="flex items-center gap-2">
          {standard !== null && !isSkipped && (
            <button
              type="button"
              onClick={() => { onChange(String(standard)); onOverrideReasonChange && onOverrideReasonChange(""); }}
              className="text-xs text-cyan-400 hover:text-cyan-300 border border-cyan-400/30 hover:border-cyan-400/60 px-2 py-0.5 rounded-md transition-all leading-none"
            >
              Use IRS ${standard.toLocaleString()}
            </button>
          )}
          {!isSkipped ? (
            <button type="button" onClick={() => { onChange("0"); onOverrideReasonChange && onOverrideReasonChange(""); }}
              className="text-xs text-slate-400 hover:text-slate-200 border border-slate-600 hover:border-slate-400 px-2 py-0.5 rounded-md transition-all leading-none">
              I don't have this
            </button>
          ) : (
            <button type="button" onClick={() => onChange("")}
              className="text-xs text-green-400 border border-green-500/40 px-2 py-0.5 rounded-md transition-all leading-none hover:border-green-400">
              Skipped — undo
            </button>
          )}
        </div>
      </div>

      {standard !== null && !isSkipped && (
        <p className="text-xs text-slate-400 mb-1.5">
          2025 IRS standard{stdLabel ? ` — ${stdLabel}` : ""}: <span className="text-cyan-400 font-semibold">${standard.toLocaleString()}/mo</span>
          {isAutoFilled && <span className="ml-2 text-green-400">auto-filled</span>}
        </p>
      )}

      {isSkipped ? (
        <div className="w-full bg-slate-800/40 border border-slate-700 rounded-lg px-3 py-2 text-slate-500 text-sm">$0.00 — not applicable</div>
      ) : (
        <input
          type="number"
          value={value}
          onChange={e => { onChange(e.target.value); if (onOverrideReasonChange && standard !== null && parseFloat(e.target.value) <= standard) onOverrideReasonChange(""); }}
          placeholder={standard ? `IRS standard: $${standard.toLocaleString()}` : "Enter amount"}
          className={`w-full bg-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none placeholder-slate-500 border ${overLimit ? "border-amber-500 focus:border-amber-400" : error ? "border-red-500 focus:border-red-400" : "border-slate-600 focus:border-amber-400"}`}
        />
      )}

      {overLimit && (
        <div className="mt-2 bg-amber-500/8 border border-amber-500/30 rounded-lg px-3 py-2.5">
          <p className="text-xs text-amber-300 font-semibold mb-1">
            Amount exceeds the IRS standard by ${(numVal - standard).toLocaleString()} — your attorney will review
          </p>
          <p className="text-xs text-slate-400 mb-2">
            The 2025 IRS standard{stdLabel ? ` (${stdLabel})` : ""} is <strong className="text-slate-300">${standard.toLocaleString()}/mo</strong>. Amounts above the standard require a documented special circumstance for the attorney to approve. If you cannot provide one, the standard amount will be used.
          </p>
          <label className="block text-xs font-semibold uppercase tracking-widest text-amber-400 mb-1">
            Reason this exceeds the IRS standard
          </label>
          <textarea
            value={overrideReason || ""}
            onChange={e => onOverrideReasonChange && onOverrideReasonChange(e.target.value)}
            placeholder="e.g., Special dietary needs, chronic medical condition, documented higher costs in this area…"
            rows={3}
            className={`w-full bg-slate-800 border rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none resize-none ${!overrideReason ? "border-amber-500/60 focus:border-amber-400" : "border-green-500/40 focus:border-green-400"}`}
          />
          {!overrideReason && <p className="text-xs text-amber-400 mt-1 flex items-center gap-1"><span>⚠</span> Please provide a reason — your attorney will need this to document the exception</p>}
          {overrideReason && <p className="text-xs text-green-400 mt-1 flex items-center gap-1"><span>✓</span> Reason recorded — flagged for attorney review</p>}
        </div>
      )}

      {error && !overLimit && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><span>⚠</span> {error}</p>}
    </div>
  );
};

const Field = ({ label, hint, error, children }) => (
  <div className="mb-5">
    <label className="block text-sm font-semibold uppercase tracking-widest text-amber-400 mb-2">{label}</label>
    {hint && <p className="text-sm text-slate-400 mb-1.5">{hint}</p>}
    {children}
    {error && <p className="text-sm text-red-400 mt-1.5 flex items-center gap-1"><span>⚠</span> {error}</p>}
  </div>
);

const ExpenseField = ({ label, hint, error, value, onChange, badge = "Monthly" }) => {
  const isSkipped = value === "0";
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <label className="block text-sm font-semibold uppercase tracking-widest text-amber-400">{label}</label>
          <span className="text-xs font-medium text-slate-400 bg-slate-700/60 border border-slate-600 px-1.5 py-0.5 rounded-md leading-none">{badge}</span>
        </div>
        {!isSkipped ? (
          <button
            type="button"
            onClick={() => onChange("0")}
            className="text-sm text-slate-400 hover:text-slate-200 border border-slate-600 hover:border-slate-400 px-2.5 py-1 rounded-md transition-all leading-none"
          >
            I don't have this
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-sm text-green-400 border border-green-500/40 px-2.5 py-1 rounded-md transition-all leading-none hover:border-green-400"
          >
            Skipped — undo
          </button>
        )}
      </div>
      {hint && <p className="text-sm text-slate-400 mb-1.5">{hint}</p>}
      {isSkipped ? (
        <div className="w-full bg-slate-800/40 border border-slate-700 rounded-lg px-4 py-3 text-slate-500 text-base">$0.00 — not applicable</div>
      ) : (
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Enter amount or click 'I don't have this' to skip"
          className={`w-full bg-slate-800 rounded-lg px-4 py-3 text-white text-base focus:outline-none placeholder-slate-500 border ${error ? "border-red-500 focus:border-red-400" : "border-slate-600 focus:border-amber-400"}`}
        />
      )}
      {error && <p className="text-sm text-red-400 mt-1.5 flex items-center gap-1"><span>⚠</span> {error}</p>}
    </div>
  );
};

const Input = ({ value, onChange, placeholder, type="text", hasError }) => (
  <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
    className={`w-full bg-slate-800 rounded-lg px-4 py-3 text-white text-base focus:outline-none placeholder-slate-500 border ${hasError?"border-red-500 focus:border-red-400":"border-slate-600 focus:border-amber-400"}`}/>
);

const Select = ({ value, onChange, options, placeholder, hasError }) => (
  <select value={value} onChange={e=>onChange(e.target.value)}
    className={`w-full bg-slate-800 rounded-lg px-4 py-3 text-white text-base focus:outline-none border ${hasError?"border-red-500 focus:border-red-400":"border-slate-600 focus:border-amber-400"}`}>
    <option value="">{placeholder||"Select..."}</option>
    {options.map(o=><option key={typeof o==="string"?o:o.value} value={typeof o==="string"?o:o.value}>{typeof o==="string"?o:o.label}</option>)}
  </select>
);

const Radio = ({ name, value, current, onChange, label, hasError }) => (
  <label className={`flex items-center gap-3 p-3.5 rounded-lg border cursor-pointer transition-all ${current===value?"border-amber-400 bg-amber-400/10 text-white":hasError?"border-red-500 text-slate-300":"border-slate-600 text-slate-300 hover:border-slate-400"}`}>
    <input type="radio" name={name} value={value} checked={current===value} onChange={()=>onChange(value)} className="hidden"/>
    <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${current===value?"border-amber-400":hasError?"border-red-500":"border-slate-500"}`}>
      {current===value && <span className="w-2 h-2 rounded-full bg-amber-400"/>}
    </span>
    <span className="text-base">{label}</span>
  </label>
);

const RadioGroup = ({ name, options, current, onChange, error }) => (
  <div>
    <div className="flex flex-wrap gap-2">{options.map(o=><Radio key={o.value} name={name} value={o.value} current={current} onChange={onChange} label={o.label} hasError={!!error}/>)}</div>
    {error && <p className="text-sm text-red-400 mt-1.5 flex items-center gap-1"><span>⚠</span> {error}</p>}
  </div>
);

const SectionCard = ({ title, icon, children }) => (
  <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 mb-5">
    <div className="flex items-center gap-2.5 mb-5"><span className="text-2xl">{icon}</span><h3 className="font-serif text-lg font-semibold text-white">{title}</h3></div>
    {children}
  </div>
);

const ErrorBanner = ({ errors }) => Object.keys(errors).length>0
  ? <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-5"><p className="text-red-400 text-sm font-semibold">⚠ Please complete all required fields highlighted in red before continuing.</p></div>
  : null;

const ExemptionPreviewCard = ({ data }) => {
  const dr = calcDomicileResult(data);
  if (!dr.exKey) {
    if (!data.addressYears) return null;
    return (
      <SectionCard title="Exemptions — Attorney Review Required" icon="⚖️">
        <div className="p-3 rounded-lg bg-amber-400/10 border border-amber-400/30 text-xs text-amber-300 mb-3 leading-relaxed">
          <span className="font-semibold block mb-1">
            {dr.rule === "no-prior" ? "⚠️ Please complete your prior address information above."
              : dr.rule === "730-day" ? `⚠️ ${dr.stateName} — exemption data coming soon.`
              : `⚠️ ${dr.stateName} — exemption schedule not yet in our database.`}
          </span>
          {dr.note || "Your attorney will review all applicable exemptions at your consultation."}
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Exemptions protect your property in bankruptcy. Your attorney will calculate exact exemption amounts before any filing.
        </p>
      </SectionCard>
    );
  }
  const ex = EXEMPTIONS[dr.exKey];
  if (!ex) return null;
  const isJoint = data.filingType === "joint";
  const fmtEx = (obj) => {
    if (!obj || obj === null) return "—";
    if (typeof obj === "string") return obj;
    const v = isJoint ? obj.joint : obj.ind;
    if (v === null || v === undefined) return obj.note || "—";
    const numStr = typeof v === "number" ? "$" + v.toLocaleString() : String(v);
    return obj.note ? `${numStr} (${obj.note})` : numStr;
  };
  const alertStyle = dr.resident ? "bg-green-400/10 border-green-400/30 text-green-300"
    : dr.rule === "state_only" ? "bg-blue-400/10 border-blue-400/30 text-blue-300"
    : "bg-amber-400/10 border-amber-400/30 text-amber-300";
  const ruleLabels = {
    "730-day": `✅ ${dr.stateName} exemptions apply — you've lived here 2+ years`,
    "state_or_federal": `✅ ${dr.stateName} state exemptions apply — debtor may also elect federal §522(d) exemptions`,
    "state_only": `ℹ️ ${dr.stateName} has opted out of federal exemptions — ${dr.stateName} state exemptions apply`,
    "savings_clause_federal": `ℹ️ ${dr.stateName} exemptions limited to residents — federal §522(d) exemptions apply`,
    "no-prior": "⚠️ Complete your prior address information to confirm applicable exemptions",
    "unknown": `⚠️ ${dr.stateName} — exemption set not yet in our database; attorney will confirm`,
  };
  const ruleLabel = ruleLabels[dr.rule] || `${dr.stateName} — attorney review required`;
  const rows = [
    ex.homestead && ["Homestead / real property", fmtEx(ex.homestead)],
    ex.vehicle && ["Motor vehicle", fmtEx(ex.vehicle)],
    ex.household && ["Household goods & furnishings", fmtEx(ex.household)],
    ex.jewelry && ["Jewelry / rings", fmtEx(ex.jewelry)],
    ex.tools && ["Tools of trade", fmtEx(ex.tools)],
    ex.wildcard && ["Wildcard — any property", fmtEx(ex.wildcard)],
    ex.lifeIns && ["Life insurance", typeof ex.lifeIns==="string" ? ex.lifeIns : fmtEx(ex.lifeIns)],
    ex.retirement && ["Retirement accounts", typeof ex.retirement==="string" ? ex.retirement : fmtEx(ex.retirement)],
    ex.wages && ["Wages", typeof ex.wages==="string" ? ex.wages : fmtEx(ex.wages)],
    ex.personalInjury && ["Personal injury / wrongful death", typeof ex.personalInjury==="string" ? ex.personalInjury : fmtEx(ex.personalInjury)],
  ].filter(Boolean);

  if (ex.homesteadByCounty && data.county) {
    const countyAmt = ex.homesteadByCounty[data.county];
    if (countyAmt) {
      const homesteadRow = rows.find(r => r && r[0] === "Homestead / real property");
      if (homesteadRow) homesteadRow[1] = `$${countyAmt.toLocaleString()} (${data.county} County)`;
    }
  }

  return (
    <SectionCard title={`${ex.label} — Exemptions Preview`} icon="🛡">
      <div className={`p-3 rounded-lg border text-xs mb-3 font-semibold ${alertStyle}`}>{ruleLabel}</div>
      {ex.note && (
        <div className="p-3 rounded-lg bg-blue-400/10 border border-blue-400/20 text-xs text-blue-300 mb-3 leading-relaxed">
          ℹ️ {ex.note}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-600">
              <th className="text-left py-2 px-2 text-slate-400 font-semibold uppercase tracking-widest">Category</th>
              <th className="text-left py-2 px-2 text-slate-400 font-semibold uppercase tracking-widest">{isJoint ? "Joint" : "Individual"} Limit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([cat, val]) => (
              <tr key={cat} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                <td className="py-2 px-2 text-slate-300">{cat}</td>
                <td className="py-2 px-2 text-amber-400 font-semibold">{val}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
};

const SourceCard = ({ who, src, idx, total, onRemove, onUpdate, onError, periodToMonthly }) => {
  const fmtD = n => n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
  const set  = (f,v) => onUpdate(who, idx, f, v);
  const err  = (f)   => onError(who, idx, f);
  const mg   = src.sourceType==="employment" ? periodToMonthly(src.grossPerPeriod, src.payFrequency) : (parseFloat(src.businessGrossIncome)||0);
  const bonus= src.sourceType==="employment" && src.receiveBonus==="yes" && src.bonusIncludedInIncome==="no" ? (parseFloat(src.bonusGross)||0)/12 : 0;

  return (
    <div className="bg-slate-900/60 border border-slate-600 rounded-xl p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Income Source {idx+1}
          {mg>0 && <span className="text-amber-400 ml-2">· ${fmtD(mg+bonus)}/mo</span>}
        </p>
        {total>1 && (
          <button onClick={onRemove} className="text-xs text-red-400 hover:text-red-300 border border-red-400/30 hover:border-red-400 px-2 py-1 rounded-lg transition-colors">Remove</button>
        )}
      </div>
      <Field label="Source Type" error={err("sourceType")}>
        <RadioGroup name={`${who}_${idx}_type`} current={src.sourceType} onChange={v=>set("sourceType",v)} error={err("sourceType")}
          options={[{value:"employment",label:"💼 Employment (W-2)"},{value:"selfEmployment",label:"🏢 Self-Employment / Business"}]}/>
      </Field>
      {src.sourceType==="employment" && <>
        <Field label="Employer Name" error={err("employerName")}>
          <Input value={src.employerName} onChange={v=>set("employerName",v)} placeholder="Employer name" hasError={!!err("employerName")}/>
        </Field>
        <Field label="Pay Frequency" error={err("payFrequency")}>
          <Select value={src.payFrequency} onChange={v=>set("payFrequency",v)} hasError={!!err("payFrequency")}
            options={["Weekly","Bi-Weekly","Semi-Monthly","Monthly"]} placeholder="Select pay frequency..."/>
        </Field>
        {src.payFrequency && <>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Gross per ${src.payFrequency==="Monthly"?"month":"pay period"}`} hint="Before taxes" error={err("grossPerPeriod")}>
              <Input type="number" value={src.grossPerPeriod} onChange={v=>set("grossPerPeriod",v)} placeholder="Enter amount" hasError={!!err("grossPerPeriod")}/>
            </Field>
            <Field label={`Net per ${src.payFrequency==="Monthly"?"month":"pay period"}`} hint="Take-home" error={err("netPerPeriod")}>
              <Input type="number" value={src.netPerPeriod} onChange={v=>set("netPerPeriod",v)} placeholder="Enter amount" hasError={!!err("netPerPeriod")}/>
            </Field>
          </div>
          {src.grossPerPeriod && (
            <div className="p-3 bg-slate-800 rounded-lg mb-3 text-xs text-slate-300 grid grid-cols-2 gap-2">
              <div><span className="text-slate-400">Monthly Gross: </span><span className="text-amber-400 font-semibold">${fmtD(periodToMonthly(src.grossPerPeriod, src.payFrequency))}</span></div>
              <div><span className="text-slate-400">Monthly Net: </span><span className="text-white font-semibold">${fmtD(periodToMonthly(src.netPerPeriod, src.payFrequency))}</span></div>
            </div>
          )}
        </>}
        <Field label="Do you receive a bonus?" error={err("receiveBonus")}>
          <RadioGroup name={`${who}_${idx}_bonus`} current={src.receiveBonus} onChange={v=>set("receiveBonus",v)} error={err("receiveBonus")}
            options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
        </Field>
        {src.receiveBonus==="yes" && (
          <Field label="Is the bonus included in your pay period figures above?" error={err("bonusIncludedInIncome")}>
            <RadioGroup name={`${who}_${idx}_bonusIncl`} current={src.bonusIncludedInIncome} onChange={v=>set("bonusIncludedInIncome",v)} error={err("bonusIncludedInIncome")}
              options={[{value:"yes",label:"Yes — already included"},{value:"no",label:"No — separate check"}]}/>
          </Field>
        )}
        {src.receiveBonus==="yes" && src.bonusIncludedInIncome==="no" && <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Annual Bonus — Gross" error={err("bonusGross")}>
              <Input type="number" value={src.bonusGross} onChange={v=>set("bonusGross",v)} placeholder="Enter amount" hasError={!!err("bonusGross")}/>
            </Field>
            <Field label="Annual Bonus — Net" error={err("bonusNet")}>
              <Input type="number" value={src.bonusNet} onChange={v=>set("bonusNet",v)} placeholder="Enter amount" hasError={!!err("bonusNet")}/>
            </Field>
          </div>
          <div className="p-3 bg-slate-800 rounded-lg mb-1 text-xs text-slate-300">
            <span className="text-slate-400">Added to monthly income: </span>
            <span className="text-amber-400 font-semibold">${fmtD((parseFloat(src.bonusGross)||0)/12)}/mo</span>
          </div>
        </>}
      </>}
      {src.sourceType==="selfEmployment" && <>
        <Field label="Business Name" error={err("businessName")}>
          <Input value={src.businessName} onChange={v=>set("businessName",v)} placeholder="Name or DBA" hasError={!!err("businessName")}/>
        </Field>
        <Field label="Type of Business" error={err("businessType")}>
          <Input value={src.businessType} onChange={v=>set("businessType",v)} placeholder="e.g. Sole proprietor, LLC, contractor" hasError={!!err("businessType")}/>
        </Field>
        <Field label="Gross Monthly Business Income" error={err("businessGrossIncome")}>
          <Input type="number" value={src.businessGrossIncome} onChange={v=>set("businessGrossIncome",v)} placeholder="Enter amount" hasError={!!err("businessGrossIncome")}/>
        </Field>
        {/* Business Expenses */}
        <div className="mt-1">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400">Monthly Business Operating Expenses</label>
            <button
              type="button"
              onClick={()=>{ const useItemized = !src.bizExpUseItemized; set("bizExpUseItemized",useItemized); if(!useItemized){["bizExpRent","bizExpPayroll","bizExpSupplies","bizExpEquipment","bizExpLicenses","bizExpMarketing","bizExpProfessional","bizExpInsurance","bizExpInventory","bizExpOther","bizExpOtherDesc"].forEach(f=>set(f,"")); set("businessExpenses",""); } }}
              className="text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors"
            >
              {src.bizExpUseItemized ? "Switch to single total" : "Itemize by category"}
            </button>
          </div>

          <div className="mb-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs text-blue-300 leading-relaxed">
            <strong>Important — actual business expenses only.</strong> Only list expenses that are ordinary, necessary, and exclusive to running your business. Trustees will scrutinize these figures. Personal expenses — even partially business-related — must <em>not</em> be listed here. If an expense also appears in your personal expense schedule (e.g. a vehicle you use for both work and personal travel), it <em>cannot</em> be double-counted. Examples of legitimate business expenses: chair rental, booth rent, supplies, tools, professional licenses, business insurance, business-only vehicle mileage reimbursement. Examples of expenses that are <em>not</em> deductible here: personal travel, recreation, clothing (unless a required uniform), meals (unless client entertainment with documentation), or anything already in your personal expense schedule.
          </div>

          {!src.bizExpUseItemized ? (
            <Field label="Total Monthly Business Operating Expenses" hint="Actual, legitimate operating costs only" error={err("businessExpenses")}>
              <Input type="number" value={src.businessExpenses} onChange={v=>set("businessExpenses",v)} placeholder="Enter amount" hasError={!!err("businessExpenses")}/>
            </Field>
          ) : (
            (() => {
              const bizFields = [
                { key:"bizExpRent",         label:"Rent / Booth Rent / Chair Rental",                       hint:"Studio, office, or chair/booth rent paid to operate" },
                { key:"bizExpPayroll",       label:"Employee Wages / Payroll",                               hint:"Wages paid to employees — not owner draws" },
                { key:"bizExpSupplies",      label:"Business Supplies & Materials",                          hint:"Consumable supplies used exclusively in the business" },
                { key:"bizExpInventory",     label:"Inventory / Cost of Goods Sold",                        hint:"Products purchased for resale" },
                { key:"bizExpEquipment",     label:"Equipment Rental / Lease",                              hint:"Equipment rented or leased exclusively for business" },
                { key:"bizExpLicenses",      label:"Licenses, Permits & Professional Dues",                 hint:"Required professional licenses, certifications, or dues" },
                { key:"bizExpMarketing",     label:"Advertising & Marketing",                               hint:"Business-only advertising, website, business cards" },
                { key:"bizExpProfessional",  label:"Professional Services (Accountant, Attorney, etc.)",    hint:"CPA, business attorney, bookkeeper for the business" },
                { key:"bizExpInsurance",     label:"Business Insurance",                                    hint:"Liability, errors & omissions, or other business-specific insurance — not personal health/life" },
                { key:"bizExpOther",         label:"Other Legitimate Business Expenses",                    hint:"Any other ordinary and necessary business cost not listed above" },
              ];
              const itemizedTotal = bizFields.reduce((s,f)=>s+(parseFloat(src[f.key])||0),0);
              return (
                <div>
                  <div className="space-y-2 mb-3">
                    {bizFields.map(f=>(
                      <div key={f.key} className="grid grid-cols-3 gap-2 items-start">
                        <div className="col-span-2">
                          <p className="text-xs text-slate-300 font-medium">{f.label}</p>
                          <p className="text-xs text-slate-500">{f.hint}</p>
                        </div>
                        <Input
                          type="number"
                          value={src[f.key]}
                          onChange={v=>{ set(f.key,v); const newTotal = bizFields.reduce((s,bf)=>s+(bf.key===f.key?(parseFloat(v)||0):(parseFloat(src[bf.key])||0)),0); set("businessExpenses",String(newTotal||"")); }}
                          placeholder="$0"
                        />
                      </div>
                    ))}
                  </div>
                  {src.bizExpOther!="" && (
                    <Field label='Describe "Other" expenses' hint="Be specific — trustees may ask for documentation">
                      <Input value={src.bizExpOtherDesc} onChange={v=>set("bizExpOtherDesc",v)} placeholder="e.g. bank fees $25, PO box $12..."/>
                    </Field>
                  )}
                  <div className="p-2 bg-slate-800/80 border border-slate-600 rounded-lg text-xs text-slate-300">
                    Itemized total: <span className="text-amber-400 font-semibold">${fmtD(itemizedTotal)}/mo</span>
                  </div>
                  <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300">
                    <strong>Not listed above?</strong> Do not include: personal vehicle use (unless reimbursed at IRS mileage rate and business-only), personal cell phone (unless a dedicated business line), personal travel, meals, clothing, or any expense already in your personal expense schedule.
                  </div>
                </div>
              );
            })()
          )}
        </div>

        {src.businessGrossIncome && src.businessExpenses!=="" && (
          <div className="p-3 bg-slate-800 rounded-lg text-xs text-slate-300 grid grid-cols-3 gap-2 mt-2">
            <div><span className="text-slate-400 block">Gross</span><span className="text-amber-400 font-semibold">${fmtD(parseFloat(src.businessGrossIncome)||0)}</span></div>
            <div><span className="text-slate-400 block">Expenses</span><span className="text-white font-semibold">− ${fmtD(parseFloat(src.businessExpenses)||0)}</span></div>
            <div><span className="text-slate-400 block">Net</span><span className="text-green-400 font-semibold">${fmtD((parseFloat(src.businessGrossIncome)||0)-(parseFloat(src.businessExpenses)||0))}</span></div>
          </div>
        )}
      </>}
    </div>
  );
};

const PersonIncomeSection = ({ who, label, personName, workStatusKey, workStatus, sources, monthlyGrossTotal, onStatusChange, onUpdate, onError, onAdd, onRemove, periodToMonthly, isSpouse }) => {
  const fmtD = n => n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
  const isEmployed = ["employed","selfEmployed","both"].includes(workStatus);
  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 mb-4">
      <div className="flex items-center justify-between mb-1">
        <div>
          <p className="font-serif text-base font-bold text-white">{personName}</p>
          <p className="text-xs text-slate-400">{label}</p>
        </div>
        {isEmployed && monthlyGrossTotal>0 && (
          <div className="text-right">
            <p className="text-xs text-slate-400">Gross/mo</p>
            <p className="text-lg font-serif font-bold text-amber-400">${monthlyGrossTotal.toLocaleString("en-US",{maximumFractionDigits:0})}</p>
          </div>
        )}
      </div>
      <Field label="Current Employment Status" error={onError(workStatusKey)}>
        <RadioGroup name={workStatusKey} current={workStatus} onChange={onStatusChange} error={onError(workStatusKey)}
          options={[
            {value:"employed", label:"💼 Employed (W-2 / Salary)"},
            {value:"selfEmployed", label:"🏢 Self-Employed / Business Owner"},
            {value:"both", label:"⚡ Both Employment + Self-Employment"},
            {value:"notEmployed", label:"🚫 Not Currently Employed"},
          ]}/>
      </Field>
      {workStatus==="notEmployed" && (
        <div className="p-3 bg-slate-700/40 border border-slate-600 rounded-lg text-xs text-slate-300">
          No employment or business income will be recorded for {personName}.
        </div>
      )}
      {isEmployed && (
        <div className="mt-3">
          {sources.map((src, i) => (
            <SourceCard key={src.id} who={who} src={src} idx={i} total={sources.length}
              onRemove={()=>onRemove(who, i)} onUpdate={onUpdate} onError={onError}
              periodToMonthly={periodToMonthly}/>
          ))}
          <button onClick={()=>onAdd(who)}
            className="w-full border border-dashed border-amber-400/40 hover:border-amber-400 text-amber-400 hover:bg-amber-400/5 text-sm font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
            <span className="text-lg leading-none">+</span> Add Another Income Source for {personName}
          </button>
        </div>
      )}
    </div>
  );
};

const GOV_OTHER_FIELDS = [
  { key:"SsRetirement",  label:"Social Security Retirement (monthly)",            section:"gov" },
  { key:"SsDisability",  label:"Social Security Disability (SSDI) — monthly",     section:"gov" },
  { key:"Veterans",      label:"VA Disability Compensation (monthly) — Non-CMI",   section:"gov" },
  { key:"VeteransRetirement", label:"Military / Veterans Retirement Pay (monthly)", section:"gov" },
  { key:"Unemployment",  label:"Unemployment Benefits (monthly)",                  section:"gov" },
  { key:"WorkersComp",   label:"Workers' Compensation (monthly)",                  section:"gov" },
  { key:"Pension",       label:"Pension / Retirement Benefits (monthly)",          section:"gov" },
  { key:"Snap",          label:"SNAP / Food Stamps (monthly)",                     section:"gov" },
  { key:"CashAssist",    label:"Cash Assistance / TANF (monthly)",                 section:"gov" },
  { key:"OtherGov",      label:"Other Government Benefits (monthly)",              section:"gov" },
  { key:"Rental",        label:"Rental Income (monthly)",                          section:"other" },
  { key:"Alimony",       label:"Alimony Received (monthly)",                       section:"other" },
  { key:"ChildSupport",  label:"Child Support Received (monthly)",                 section:"other" },
  { key:"FamilySupport", label:"Support from Friends and Family (monthly)",        section:"other" },
  { key:"Royalties",     label:"Royalties / IP Income (monthly)",                  section:"other" },
  { key:"Investment",    label:"Investment / Dividend / Interest Income (monthly)",section:"other" },
  { key:"OtherIncome",   label:"Any Other Monthly Income",                         section:"other" },
];

function GovIncomeRow({ label, fieldKey, value, onChange, isNA, onToggleNA }) {
  if (isNA) {
    return (
      <div className="flex items-center justify-between py-2 mb-3 border-b border-slate-700/40">
        <span className="text-xs text-slate-600 line-through">{label}</span>
        <button type="button" onClick={() => onToggleNA(fieldKey)}
          className="text-xs text-slate-500 hover:text-amber-400 transition-colors ml-4 shrink-0">
          Undo
        </button>
      </div>
    );
  }
  return (
    <Field label={label}>
      <div className="flex gap-2 items-center">
        <div className="flex-1">
          <Input type="number" value={value} onChange={onChange} placeholder="Enter amount" />
        </div>
        <button type="button"
          onClick={() => { onChange(""); onToggleNA(fieldKey); }}
          className="shrink-0 text-xs text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 border border-slate-600 hover:border-slate-500 px-3 py-2 rounded-lg transition-all whitespace-nowrap">
          I do not have
        </button>
      </div>
    </Field>
  );
}

export default function BankruptcyIntake({ clientId, clientName, clientEmail, clientPhone, staffMode } = {}) {
  const isStaffSession = !!staffMode;
  const isTakeover = staffMode?.mode === 'takeover';
  const [step, setStep] = useState(0);
  const [started, setStarted] = useState(isStaffSession);
  const [errors, setErrors] = useState({});
  const [notApplicable, setNotApplicable] = useState({});
  const [scheduleState, setScheduleState] = useState("idle");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitRef, setSubmitRef] = useState("");
  const [appt, setAppt] = useState({ name:"", phone:"", email:"", preferredDate:"", preferredTime:"", notes:"", consultType:"phone" });
  const [piSubmitStatus, setPiSubmitStatus] = useState("idle"); // idle | submitting | submitted | error
  const topRef = useRef(null);
  const sessionId = useMemo(() => `intake_${Date.now()}_${Math.random().toString(36).slice(2)}`, []);

  const [data, setData] = useState({
    maritalStatus:"", filingType:"", firstName:"", lastName:"", email: clientEmail||"", phone: clientPhone||"", spouseFirstName:"", spouseLastName:"",
    address:"", city:"", zip:"",
    state:"", county:"", addressYears:"",
    priorDomicileState:"",
    priorAddr1Street:"", priorAddr1City:"", priorAddr1State:"", priorAddr1From:"", priorAddr1To:"",
    numDependents:"0", dependents:[], householdSizeChanged:"", householdSizeChangeDetails:"",
    debtorWorkStatus:"",
    debtorSources:[emptySource(1)],
    spouseWorkStatus:"",
    spouseSources:[emptySource(2)],
    dSsRetirement:"", dSsDisability:"", dVeterans:"", dVeteransRetirement:"",
    dUnemployment:"", dWorkersComp:"", dPension:"", dPensionSource:"",
    dSnap:"", dCashAssist:"", dHousingAssist:"", dOtherGov:"",
    dRental:"", dAlimony:"", dChildSupport:"",
    dFamilySupport:"", dFamilySupportDesc:"",
    dRoyalties:"", dInvestment:"", dOtherIncome:"", dOtherIncomeDesc:"",
    sSsRetirement:"", sSsDisability:"", sVeterans:"", sVeteransRetirement:"",
    sUnemployment:"", sWorkersComp:"", sPension:"", sPensionSource:"",
    sSnap:"", sCashAssist:"", sHousingAssist:"", sOtherGov:"",
    sRental:"", sAlimony:"", sChildSupport:"",
    sFamilySupport:"", sFamilySupportDesc:"",
    sRoyalties:"", sInvestment:"", sOtherIncome:"", sOtherIncomeDesc:"",
    avgMonthly6:"",
    expRentMortgage:"", mortgageIncludesInsurance:"", mortgageInsuranceAmount:"", mortgageTaxAmount:"", expPropTax:"", expHoa:"",
    payLotSpaceRent:"", expLotSpaceRent:"",
    expElectricGas:"", expElectricGasOverride:"",
    expWaterSewer:"", expWaterSewerOverride:"",
    expPhone:"", expPhoneOverride:"",
    expInternet:"",
    expFood:"", expFoodOverride:"",
    expHouseholdSupplies:"", expHouseholdSuppliesOverride:"",
    expClothing:"", expClothingOverride:"",
    expPersonalCare:"", expPersonalCareOverride:"",
    expMisc:"", expMiscOverride:"",
    expGasFuel:"", expGasFuelOverride:"",
    expCarMaintenance:"", expPublicTransit:"",
    expInsVehicleOverride:"",
    expMedical:"",
    expInsHealth:"", expInsLife:"", expInsVehicle:"",
    expInsHome:"", expInsDisability:"", expInsOther:"",
    expChildcare:"", expChildEducation:"",
    expCharitable:"", expRecreation:"", expHomeMaintenance:"",
    expAddlTaxes:"", expAlimonyPaid:"", expSupportOthers:"",
    expGovFines:"", expOther:"",
    ownsRealEstate:"", realPropIntent:"", realPropType:"Primary Residence", realPropAddress:"", realPropValue:"", realPropValueDate:"", realPropValueConfirmed:false, mortgageBalance:"",
    realPropState:"", realPropMonthlyPayment:"",
    isOccupiedPrimary:"", homeAcquiredDate:"",
    realPropOwnershipType:"", realPropOwnedBeforeMarriage:"", realPropMaritalFundsUsed:"", realPropHasPrenup:"", realPropInheritedOrGift:"", realPropCommunityPropFlag:false,
    secondPropOwnershipType:"", secondPropOwnedBeforeMarriage:"", secondPropMaritalFundsUsed:"", secondPropHasPrenup:"", secondPropInheritedOrGift:"", secondPropCommunityPropFlag:false,
    nfsAssets:"", nfsAssetDetails:"",
    payRentAtResidence:"", rentAtResidence:"",
    hasHoa:"",
    hoaName:"", hoaMonthlyDues:"", hoaIsCurrent:"", hoaPastDueAmount:"",
    hasLiens:"",
    liens:[],
    zillowLookup:{status:"idle", zestimate:null, low:null, high:null, lastUpdated:null, error:null},
    zillowLookup2:{status:"idle", zestimate:null, low:null, high:null, lastUpdated:null, error:null},
    secondProperty:"", secondPropAddress:"", secondPropValue:"", secondMortgage:"", secondMortgagePayment:"",
    hasInvestmentProperty:"", hasRawLandTimeshare:"", hasNameOnOthersRealEstate:"",
    hasVehicles:"",
    vehicles:[{id:1,type:"",year:"",make:"",model:"",value:"",intent:"",hasLoan:"",loanBalance:"",monthlyPayment:"",valuationStatus:"idle",valuationResult:null,valuationError:null,valuationOverride:false,overrideReason:"",overrideDetails:"",ownershipType:"",ownedBeforeMarriage:"",maritalFundsUsed:"",hasPrenup:"",inheritedOrGift:"",communityPropFlag:false}],
    noVehicles:false,
    hasBankAccounts:"",
    bankAccounts:[{id:1,bankName:"",accountType:"",balance:""}], noBankAccounts:false,
    hasRetirement:"",
    retirementAccounts:[{id:1, accountType:"", institution:"", balance:"", ownerName:""}], noRetirement:false,
    hasLifeInsurance:"",
    lifePolicies:[{id:1,policyType:"",faceValue:"",cashValue:"",beneficiary:"",purchaseDate:""}],
    hasAnnuities:"",
    annuities:[{id:1,annuityType:"",currentValue:"",yearsHeld:"",beneficiary:"",purchaseDate:""}],
    hasPendingClaims:"", pendingClaimsDesc:"", pendingClaimsValue:"",
    hasSsClaim:"", ssPendingDesc:"",
    hasSsBackPay:"", ssBackPayAmount:"", ssBackPaySegregated:"",
    hasMoneyOwed:"", moneyOwedDesc:"", moneyOwedAmt:"",
    hasHouseholdGoods:"",
    noHouseholdGoods:false,
    householdGoodsValue:"", electronicsValue:"", jewelryValue:"", toolsValue:"",
    hasStocks:"", stocksValue:"", stocksDesc:"",
    hasCrypto:"", cryptoValue:"", cryptoDesc:"",
    hasFirearms:"", firearms:[{id:1, description:"", serialKnown:"", value:""}],
    hasCollectibles:"", collectiblesValue:"", collectiblesDesc:"",
    hasOtherPersonalProp:"", otherPersonalPropValue:"", otherPersonalPropDesc:"",
    hasBusinessAssets:"",
    businessAssets:[{id:1, assetType:"", description:"", estimatedValue:"", owedOnIt:"", lienHolder:""}],

    mortgageCurrent:"", mortgageArrears:"",
    securedDebt:"", hasMortgage:"",
    creditCardDebt:"", medicalDebt:"", studentLoanDebt:"", taxDebt:"",
    personalLoanDebt:"", judgmentDebt:"", otherUnsecured:"",
    childSupportCurrent:"", childSupportArrears:"", noChildSupportArrears:false,
    alimonyCurrent:"", alimonyArrears:"", noAlimonyArrears:false,
    noCreditCardDebt:false, noMedicalDebt:false, noStudentLoanDebt:false, noTaxDebt:false,
    noPersonalLoanDebt:false, noJudgmentDebt:false, noOtherUnsecured:false,
    finesInvolveDui:"", finesDuiInfo:false,
    hasBusinessDebt:"",
    sbaEidlDebt:"", sba7aDebt:"", businessEquipmentDebt:"", businessLineDebt:"",
    supplyVendorDebt:"", businessCreditCardDebt:"", businessMortgageDebt:"", otherBusinessDebt:"",
    noSbaEidlDebt:false, noSba7aDebt:false, noBusinessEquipmentDebt:false, noBusinessLineDebt:false,
    noSupplyVendorDebt:false, noBusinessCreditCardDebt:false, noBusinessMortgageDebt:false, noOtherBusinessDebt:false,
    businessDebtDesc:"",
    priorBankruptcy:"",
    priorBankruptcies:[{id:1, chapter:"", yearFiled:"", disposition:"", caseNumber:"", district:""}],
    transferredProperty:"",
    transfers:[{id:1, description:"", recipient:"", amount:"", date:"", relationship:"", fairMarketValue:"", soldForLess:""}],
    preferentialPayments:"",
    preferentialEntries:[{id:1, creditor:"", amount:"", date:"", type:"", dateConfirmedRecent:""}],
    preferentialPaymentsInsider:"",
    preferentialInsiderEntries:[{id:1, creditor:"", amount:"", date:"", relationship:"", dateConfirmedRecent:"", dateIsOld:""}],
    createdTrust:"", trustDetails:"",
    pendingLawsuits:"", lawsuitDetails:"",
    ownedBusiness:"", businessDetails:"",
    expectedRefund:"", refundAmount:"",
    dsoObligation:"", dsoAmount:"",
    recentLuxury:"", luxuryDetails:"",
    garnishment:"",
    garnishmentCreditor:"",
    garnishmentMonthlyAmount:"",
    foreclosurePending:"",
    foreclosureDate:"",
    confirmedAccurate: false,
    readInfoSheet: false,
    piHasClaim: "",
    piDateOfLoss: "",
    piIncidentDescription: "",
    piIncidentLocation: "",
    piAtFaultName: "",
    piAtFaultPhone: "",
    piAtFaultInsurance: "",
    piOtherParties: "",
    piPoliceReport: "",
    piPoliceReportNumber: "",
    piPoliceDepartment: "",
    piWasInjured: "",
    piInjuryDescription: "",
    piMedicalTreatment: "",
    piMedicalProvider: "",
    piHasAttorney: "",
    piAttorneyName: "",
    piAttorneyPhone: "",
    piAttorneyFirm: "",
    piPropertyDamage: "",
    piPropertyDamageDesc: "",
    piAdditionalNotes: "",
    piSubmitted: false,
  });

  useEffect(() => {
    if (!isStaffSession || !clientId) return;
    (async () => {
      const { data: sub } = await supabase
        .from("intake_submissions")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!sub) return;
      const str = (v) => (v != null ? String(v) : "");
      setData(prev => ({
        ...prev,
        // Filing / identity
        filingType:       sub.filing_type       || prev.filingType,
        maritalStatus:    sub.marital_status    || prev.maritalStatus,
        firstName:        sub.first_name        || prev.firstName,
        lastName:         sub.last_name         || prev.lastName,
        email:            sub.email             || prev.email,
        phone:            sub.phone             || prev.phone,
        spouseFirstName:  sub.spouse_first_name || prev.spouseFirstName,
        spouseLastName:   sub.spouse_last_name  || prev.spouseLastName,
        // Residence
        address:          sub.street_address    || prev.address,
        city:             sub.city              || prev.city,
        state:            sub.state             || prev.state,
        zip:              sub.zip_code          || prev.zip,
        county:           sub.county            || prev.county,
        addressYears:     sub.address_years     || prev.addressYears,
        priorDomicileState: sub.prior_state     || prev.priorDomicileState,
        // Household
        numDependents:    sub.num_dependents != null ? String(sub.num_dependents) : prev.numDependents,
        dependents:       sub.dependents_json   || prev.dependents,
        // Income
        debtorWorkStatus: sub.debtor_work_status || prev.debtorWorkStatus,
        spouseWorkStatus: sub.spouse_work_status || prev.spouseWorkStatus,
        debtorSources:    sub.income_sources_json?.filter(s => s.owner === "debtor" || !s.owner) || prev.debtorSources,
        spouseSources:    sub.income_sources_json?.filter(s => s.owner === "spouse") || prev.spouseSources,
        // Expenses — DB stores aggregated buckets; map totals into primary line items
        expRentMortgage:  str(sub.exp_rent_mortgage),
        expElectricGas:   str(sub.exp_utilities),
        expFood:          str(sub.exp_food),
        expGasFuel:       str(sub.exp_transportation),
        expMedical:       str(sub.exp_healthcare),
        expInsHealth:     str(sub.exp_insurance),
        expChildcare:     str(sub.exp_childcare),
        expOther:         str(sub.exp_other),
        // Real property
        ownsRealEstate:   sub.owns_real_estate ? "yes" : "no",
        realPropAddress:  sub.real_prop_address  || prev.realPropAddress,
        realPropValue:    str(sub.real_prop_value),
        mortgageBalance:  str(sub.mortgage_balance),
        // Vehicles
        noVehicles:       sub.no_vehicles || false,
        vehicles:         sub.vehicles_json || prev.vehicles,
        // Personal property
        hasStocks:        sub.has_stocks      ? "yes" : "no",
        stocksValue:      str(sub.stocks_value),
        hasCrypto:        sub.has_crypto      ? "yes" : "no",
        cryptoValue:      str(sub.crypto_value),
        hasLifeInsurance: sub.has_life_insurance  ? "yes" : "no",
        hasFirearms:      sub.has_firearms        ? "yes" : "no",
        hasCollectibles:  sub.has_collectibles    ? "yes" : "no",
        collectiblesValue: str(sub.collectibles_value),
        householdGoodsValue: str(sub.household_goods_value),
        otherPersonalPropDesc: sub.other_property_desc || prev.otherPersonalPropDesc,
        // Debts
        securedDebt:      str(sub.secured_debt),
        creditCardDebt:   str(sub.credit_card_debt),
        medicalDebt:      str(sub.medical_debt),
        studentLoanDebt:  str(sub.student_loan_debt),
        taxDebt:          str(sub.tax_debt),
        personalLoanDebt: str(sub.personal_loan_debt),
        otherUnsecured:   str(sub.other_unsecured),
        // Financial history
        priorBankruptcy:  (sub.has_prior_bk || sub.prior_bankruptcy) ? "yes" : "no",
        priorBankruptcies: sub.prior_bankruptcies_json || prev.priorBankruptcies,
        pendingLawsuits:  sub.pending_lawsuits ? "yes" : "no",
        lawsuitDetails:   sub.lawsuit_details  || prev.lawsuitDetails,
        garnishment:      sub.garnishment      ? "yes" : "no",
        transferredProperty: (sub.has_transfers || sub.transferred_property) ? "yes" : "no",
        transfers:        sub.transfers_json   || prev.transfers,
        preferentialPayments: sub.has_preferential_payments ? "yes" : "no",
        preferentialEntries: sub.preferential_payments_json || prev.preferentialEntries,
        ownedBusiness:    sub.owned_business   ? "yes" : "no",
        businessDetails:  sub.business_details || prev.businessDetails,
        expectedRefund:   sub.expected_refund  ? "yes" : "no",
        refundAmount:     str(sub.refund_amount),
        recentLuxury:     sub.recent_luxury    ? "yes" : "no",
        luxuryDetails:    sub.luxury_details   || prev.luxuryDetails,
      }));
    })();
  }, [isStaffSession, clientId]);

  // When the debtor confirms their primary residence is the owned property,
  // parse the realPropAddress string into the personal-info address fields.
  useEffect(() => {
    if (data.isOccupiedPrimary !== "yes" || !data.realPropAddress) return;
    if (data.address) return; // already populated — don't overwrite manual entry
    // realPropAddress is stored as "Street, City, State ZIP" free-text
    const raw = data.realPropAddress.trim();
    // Try to split on the last comma-separated segment that looks like "State ZIP"
    const parts = raw.split(",").map(s => s.trim());
    if (parts.length >= 3) {
      const streetParts = parts.slice(0, parts.length - 2);
      const cityPart    = parts[parts.length - 2];
      const stateZip    = parts[parts.length - 1];
      const szMatch     = stateZip.match(/^([A-Za-z\s]+)\s+(\d{5}(?:-\d{4})?)$/);
      setData(prev => ({
        ...prev,
        address: streetParts.join(", "),
        city:    cityPart,
        zip:     szMatch ? szMatch[2].trim() : stateZip,
      }));
    } else if (parts.length === 2) {
      setData(prev => ({ ...prev, address: parts[0], city: parts[1] }));
    } else {
      setData(prev => ({ ...prev, address: raw }));
    }
  }, [data.isOccupiedPrimary, data.realPropAddress]);

  const u = (f, v) => {
    setData(p=>({...p,[f]:v}));
    if (errors[f]) setErrors(p=>{const n={...p};delete n[f];return n;});
  };
  const toggleNA = (fieldKey) => {
    setNotApplicable(prev => {
      const next = {...prev};
      if (next[fieldKey]) { delete next[fieldKey]; }
      else { next[fieldKey] = true; }
      return next;
    });
  };
  const uSrc = (who, idx, field, val) => {
    setData(p=>{const arr=[...p[who]];arr[idx]={...arr[idx],[field]:val};return {...p,[who]:arr};});
    const k=`${who}_${idx}_${field}`;
    if (errors[k]) setErrors(p=>{const n={...p};delete n[k];return n;});
  };
  const addSrc = (who) => setData(p=>({...p,[who]:[...p[who],emptySource(Date.now())]}));
  const emptyBank = (id) => ({id, bankName:"", accountType:"", balance:""});
  const emptyRetirementAccount = (id) => ({id, accountType:"", institution:"", balance:"", ownerName:""});
  const emptyFirearm = (id) => ({id, description:"", serialKnown:"", value:""});
  const emptyPriorBk = (id) => ({id, chapter:"", yearFiled:"", disposition:"", caseNumber:"", district:""});
  const emptyTransfer = (id) => ({id, description:"", recipient:"", amount:"", date:"", relationship:"", fairMarketValue:"", soldForLess:""});
  const emptyBusinessAsset = (id) => ({id, assetType:"", description:"", estimatedValue:"", owedOnIt:"", lienHolder:""});
  const emptyPreferential = (id) => ({id, creditor:"", amount:"", date:"", type:"", dateConfirmedRecent:""});
  const emptyPreferentialInsider = (id) => ({id, creditor:"", amount:"", date:"", relationship:"", dateConfirmedRecent:"", dateIsOld:""});

  function parseMmYyyy(mmyyyy) {
    if (!mmyyyy || !mmyyyy.includes("/")) return null;
    const parts = mmyyyy.trim().split("/");
    if (parts.length < 2) return null;
    const m = parseInt(parts[0], 10);
    const y = parseInt(parts[1], 10);
    if (isNaN(m) || isNaN(y) || m < 1 || m > 12 || y < 1900) return null;
    return new Date(y, m - 1, 1);
  }
  function daysSince(mmyyyy) {
    const d = parseMmYyyy(mmyyyy);
    if (!d) return null;
    return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  }
  const emptyPolicy = (id) => ({id, policyType:"", faceValue:"", cashValue:"", beneficiary:"", purchaseDate:""});
  const emptyAnnuity = (id) => ({id, annuityType:"", currentValue:"", yearsHeld:"", beneficiary:"", purchaseDate:""});
  const emptyLien = (id) => ({id, lienType:"", lienHolder:"", balance:"", monthlyPayment:"", isCurrent:"", pastDueAmount:""});
  const addVehicle = () => setData(p=>({...p,vehicles:[...p.vehicles,emptyVehicle(Date.now())]}));
  const remVehicle = (idx) => setData(p=>({...p,vehicles:p.vehicles.filter((_,i)=>i!==idx)}));
  const uVehicle = (idx,field,val) => setData(p=>{const a=[...p.vehicles];a[idx]={...a[idx],[field]:val};return{...p,vehicles:a};});
  const financedVehicles = () => data.vehicles.filter(v=>v.hasLoan==="yes" && v.type);
  const uArr = (arr, idx, field, val) => setData(p=>{const a=[...p[arr]];a[idx]={...a[idx],[field]:val};return{...p,[arr]:a};});
  const addArr = (arr, emptyFn) => setData(p=>({...p,[arr]:[...p[arr],emptyFn(Date.now())]}));
  const remArr = (arr, idx) => setData(p=>({...p,[arr]:p[arr].filter((_,i)=>i!==idx)}));
  const removeSrc = (who,idx) => setData(p=>({...p,[who]:p[who].filter((_,i)=>i!==idx)}));
  const eSrc = (who,idx,field) => errors[`${who}_${idx}_${field}`];
  const e = (f) => errors[f];

  const periodToMonthly = (amount, freq) => {
    const n = parseFloat(amount)||0;
    const m = {"Weekly":52/12,"Bi-Weekly":26/12,"Semi-Monthly":2,"Monthly":1};
    return n*(m[freq]||0);
  };
  const srcMonthlyGross = (src) =>
    src.sourceType==="employment"
      ? periodToMonthly(src.grossPerPeriod, src.payFrequency)
      : (parseFloat(src.businessGrossIncome)||0);
  const srcBonusGross = (src) =>
    src.sourceType==="employment" && src.receiveBonus==="yes" && src.bonusIncludedInIncome==="no"
      ? (parseFloat(src.bonusGross)||0)/12 : 0;
  const srcMonthlyNet = (src) =>
    src.sourceType==="employment"
      ? periodToMonthly(src.netPerPeriod||src.grossPerPeriod, src.payFrequency)
      : Math.max(0, (parseFloat(src.businessGrossIncome)||0)-(parseFloat(src.businessExpenses)||0));
  const srcBusinessOpExp = (src) =>
    src.sourceType!=="employment" ? (parseFloat(src.businessExpenses)||0) : 0;

  const monthlyGross = () => data.debtorSources.reduce((s,src)=>s+srcMonthlyGross(src)+srcBonusGross(src),0);
  const spouseMonthlyGross = () => data.spouseSources.reduce((s,src)=>s+srcMonthlyGross(src)+srcBonusGross(src),0);

  const monthlyGrossWages = () => data.debtorSources.filter(s=>s.sourceType==="employment").reduce((s,src)=>s+srcMonthlyGross(src)+srcBonusGross(src),0);
  const spouseMonthlyGrossWages = () => data.spouseSources.filter(s=>s.sourceType==="employment").reduce((s,src)=>s+srcMonthlyGross(src)+srcBonusGross(src),0);

  const monthlyBusinessGross = () => data.debtorSources.filter(s=>s.sourceType!=="employment").reduce((s,src)=>s+srcMonthlyGross(src),0);
  const spouseMonthlyBusinessGross = () => data.spouseSources.filter(s=>s.sourceType!=="employment").reduce((s,src)=>s+srcMonthlyGross(src),0);

  const monthlyBusinessOpExp = () => data.debtorSources.reduce((s,src)=>s+srcBusinessOpExp(src),0);
  const spouseMonthlyBusinessOpExp = () => data.spouseSources.reduce((s,src)=>s+srcBusinessOpExp(src),0);

  const monthlyNetWages = () => data.debtorSources.filter(s=>s.sourceType==="employment").reduce((s,src)=>s+srcMonthlyNet(src),0);
  const spouseMonthlyNetWages = () => data.spouseSources.filter(s=>s.sourceType==="employment").reduce((s,src)=>s+srcMonthlyNet(src),0);

  const monthlyNetBusiness = () => data.debtorSources.filter(s=>s.sourceType!=="employment").reduce((s,src)=>s+srcMonthlyNet(src),0);
  const spouseMonthlyNetBusiness = () => data.spouseSources.filter(s=>s.sourceType!=="employment").reduce((s,src)=>s+srcMonthlyNet(src),0);

  const nonBusinessGovOtherFields = [
    data.dSsRetirement, data.dSsDisability, data.dVeterans, data.dVeteransRetirement,
    data.dUnemployment, data.dWorkersComp, data.dPension,
    data.dSnap, data.dCashAssist, data.dHousingAssist, data.dOtherGov,
    data.dRental, data.dAlimony, data.dChildSupport,
    data.dFamilySupport, data.dRoyalties, data.dInvestment, data.dOtherIncome,
    data.sSsRetirement, data.sSsDisability, data.sVeterans, data.sVeteransRetirement,
    data.sUnemployment, data.sWorkersComp, data.sPension,
    data.sSnap, data.sCashAssist, data.sHousingAssist, data.sOtherGov,
    data.sRental, data.sAlimony, data.sChildSupport,
    data.sFamilySupport, data.sRoyalties, data.sInvestment, data.sOtherIncome,
  ];

  const govOtherTotal = () => nonBusinessGovOtherFields.reduce((s,v)=>s+(parseFloat(v)||0),0);

  const dependentContributionsTotal = () =>
    data.dependents.filter(d=>d.contributesFinancially==="yes").reduce((s,d)=>s+(parseFloat(d.monthlyContribution)||0),0);

  const totalIncome = () => [
    monthlyGross(), spouseMonthlyGross(),
    ...nonBusinessGovOtherFields,
    dependentContributionsTotal(),
  ].reduce((s,v)=>s+(parseFloat(v)||0),0);

  const ch7NetMonthlyIncome = () =>
    monthlyNetWages() + spouseMonthlyNetWages() +
    monthlyNetBusiness() + spouseMonthlyNetBusiness() +
    govOtherTotal();

  const ch13NetMonthlyIncome = () =>
    monthlyNetWages() + spouseMonthlyNetWages() +
    monthlyBusinessGross() + spouseMonthlyBusinessGross() +
    govOtherTotal();

  const debtorGovOther = () => [
    data.dSsRetirement, data.dSsDisability, data.dVeterans, data.dVeteransRetirement,
    data.dUnemployment, data.dWorkersComp, data.dPension,
    data.dSnap, data.dCashAssist, data.dHousingAssist, data.dOtherGov,
    data.dRental, data.dAlimony, data.dChildSupport,
    data.dFamilySupport, data.dRoyalties, data.dInvestment, data.dOtherIncome,
  ].reduce((s,v)=>s+(parseFloat(v)||0),0);

  const spouseGovOther = () => [
    data.sSsRetirement, data.sSsDisability, data.sVeterans, data.sVeteransRetirement,
    data.sUnemployment, data.sWorkersComp, data.sPension,
    data.sSnap, data.sCashAssist, data.sHousingAssist, data.sOtherGov,
    data.sRental, data.sAlimony, data.sChildSupport,
    data.sFamilySupport, data.sRoyalties, data.sInvestment, data.sOtherIncome,
  ].reduce((s,v)=>s+(parseFloat(v)||0),0);

  const totalConsumerDebt = () => [
    data.securedDebt, data.creditCardDebt, data.medicalDebt,
    data.studentLoanDebt, data.personalLoanDebt, data.judgmentDebt,
    data.childSupportArrears, data.alimonyArrears, data.otherUnsecured,
  ].reduce((s,v)=>s+(parseFloat(v)||0),0);

  const totalBusinessDebt = () => [
    data.sbaEidlDebt, data.sba7aDebt, data.businessEquipmentDebt,
    data.businessLineDebt, data.supplyVendorDebt, data.businessCreditCardDebt,
    data.businessMortgageDebt, data.otherBusinessDebt, data.taxDebt,
  ].reduce((s,v)=>s+(parseFloat(v)||0),0);

  const totalDebt = () => totalConsumerDebt() + totalBusinessDebt();

  const meansTestExempt = () => {
    const total = totalConsumerDebt() + totalBusinessDebt();
    if (total === 0) return null;
    return totalBusinessDebt() > totalConsumerDebt();
  };
  const nonConsumerPct = () => {
    const total = totalConsumerDebt() + totalBusinessDebt();
    if (total === 0) return 0;
    return Math.round((totalBusinessDebt() / total) * 100);
  };

  const totalLienPayments = () => (data.liens||[]).reduce((s,l)=>s+(parseFloat(l.monthlyPayment)||0),0);
  const totalLienBalances = () => (data.liens||[]).reduce((s,l)=>s+(parseFloat(l.balance)||0),0);

  const totalExpenses = () => [
    data.realPropMonthlyPayment ? data.realPropMonthlyPayment : data.expRentMortgage, data.expPropTax, data.expHoa,
    data.expElectricGas, data.expWaterSewer, data.expPhone, data.expInternet,
    data.expFood, data.expHouseholdSupplies, data.expClothing, data.expPersonalCare, data.expMisc,
    data.expGasFuel, data.expCarMaintenance, data.expPublicTransit,
    ...financedVehicles().map(v=>v.monthlyPayment),
    ...(data.liens||[]).map(l=>l.monthlyPayment),
    data.expMedical,
    data.expInsHealth, data.expInsLife, data.expInsVehicle, data.expInsHome, data.expInsDisability, data.expInsOther,
    data.expChildcare, data.expChildEducation,
    data.expCharitable, data.expRecreation, data.expHomeMaintenance,
    data.expAddlTaxes, data.expAlimonyPaid, data.expSupportOthers, data.expGovFines, data.expOther,
  ].reduce((s,v)=>s+(parseFloat(v)||0),0);

  const realEquity = () => (parseFloat(data.realPropValue)||0)-(parseFloat(data.mortgageBalance)||0);

  const SEASONING_DAYS = 730;
  const daysOwned = (purchaseDate) => {
    if (!purchaseDate) return null;
    const d = new Date(purchaseDate);
    if (isNaN(d)) return null;
    return Math.floor((new Date() - d) / (1000*60*60*24));
  };
  const isSeasoned = (purchaseDate) => {
    const days = daysOwned(purchaseDate);
    return days === null ? null : days >= SEASONING_DAYS;
  };

  const homesteadDaysOwned = () => {
    if (!data.homeAcquiredDate) return null;
    const acquired = new Date(data.homeAcquiredDate);
    if (isNaN(acquired)) return null;
    return Math.floor((new Date() - acquired) / (1000*60*60*24));
  };
  const meets1215Rule = () => {
    const days = homesteadDaysOwned();
    return days === null ? null : days >= 1215;
  };

  const retirementTotal = () => data.noRetirement ? 0 : data.retirementAccounts.reduce((s,a)=>s+(parseFloat(a.balance)||0),0);

  const RETIREMENT_TYPES = [
    { value:"401k", label:"401(k) — Employer Plan", erisa:true, iraCapApplies:false, note:"Fully exempt — ERISA-qualified under § 522(b)(3)(C)" },
    { value:"403b", label:"403(b) — Nonprofit/Gov Employer Plan", erisa:true, iraCapApplies:false, note:"Fully exempt — ERISA-qualified" },
    { value:"traditional_ira", label:"Traditional IRA", erisa:false, iraCapApplies:true, note:"Exempt up to $1,512,350 under § 522(n)" },
    { value:"roth_ira", label:"Roth IRA", erisa:false, iraCapApplies:true, note:"Exempt up to $1,512,350 under § 522(n)" },
    { value:"sep_ira", label:"SEP IRA — Self-Employed", erisa:true, iraCapApplies:false, note:"Fully exempt — treated as ERISA-qualified" },
    { value:"simple_ira", label:"SIMPLE IRA", erisa:true, iraCapApplies:false, note:"Fully exempt — treated as ERISA-qualified" },
    { value:"pension", label:"Defined Benefit Pension", erisa:true, iraCapApplies:false, note:"Fully exempt — ERISA-qualified" },
    { value:"inherited_ira", label:"Inherited IRA", erisa:false, iraCapApplies:false, exempt:false, note:"⚠ NOT exempt — Clark v. Rameker (2014)" },
    { value:"nonqualified", label:"Non-Qualified Deferred Compensation", erisa:false, iraCapApplies:false, exempt:false, note:"⚠ NOT exempt" },
    { value:"other", label:"Other Retirement / Pension Account", erisa:false, iraCapApplies:false, note:"Exemption depends on plan type — attorney review required" },
  ];
  const IRA_CAP = 1512350;

  const needsPriorAddresses = () => ["Less than 91 days","91 days – 6 months","6 months – 2 years"].includes(data.addressYears);

  const domicileWindow = (() => {
    const today = new Date();
    const day730 = new Date(today); day730.setDate(today.getDate() - 730);
    const day910 = new Date(today); day910.setDate(today.getDate() - 910);
    const fmt = (d) => d.toLocaleDateString("en-US",{month:"long",year:"numeric"});
    const fmtShort = (d) => d.toLocaleDateString("en-US",{month:"short",year:"numeric"});
    return { windowStart:day910, windowEnd:day730, label:`${fmt(day910)} – ${fmt(day730)}`, labelShort:`${fmtShort(day910)} – ${fmtShort(day730)}` };
  })();

  const validateStep = (s) => {
    const errs = {};
    const req = (f,msg="This field is required") => { if (!data[f]||!data[f].toString().trim()) errs[f]=msg; };
    const reqN = (f,msg="Amount required — enter 0 if not applicable") => { if (data[f]===""||data[f]===null||data[f]===undefined) errs[f]=msg; };
    const reqSrc = (who,i,f,msg) => { const v=data[who][i]?.[f]; if (!v||!v.toString().trim()) errs[`${who}_${i}_${f}`]=msg||"Required"; };
    const reqNSrc = (who,i,f,msg) => { const v=data[who][i]?.[f]; if (v===""||v===null||v===undefined) errs[`${who}_${i}_${f}`]=msg||"Amount required — enter 0 if not applicable"; };

    if (s===0) {
      req("maritalStatus","Please confirm your marital status");
      req("filingType","Please select a filing type");
      req("firstName","First name is required"); req("lastName","Last name is required");
      req("email","Email address is required");
      req("phone","Phone number is required");
      if (data.filingType==="joint"||data.filingType==="individual-nonfiling-spouse") {
        req("spouseFirstName","Spouse first name is required"); req("spouseLastName","Spouse last name is required");
      }
      req("address","Street address is required");
      req("city","City is required");
      req("zip","ZIP code is required");
      req("state","Please select your state"); req("county","County is required");
      req("addressYears","Please select how long you've lived here");
      if (needsPriorAddresses()) {
        req("priorDomicileState","Please select the state where you lived during the exemption lookback period");
      }
    }
    if (s===1) {
      if (parseInt(data.numDependents)>0) {
        data.dependents.forEach((dep,i)=>{
          if (!dep.age) errs[`dep_${i}_age`]="Age required";
          if (!dep.relationship||!dep.relationship.trim()) errs[`dep_${i}_relationship`]="Relationship required";
        });
      }
    }
    if (s===2) {
      req("debtorWorkStatus","Please select employment status");
      if (["employed","selfEmployed","both"].includes(data.debtorWorkStatus)) {
        data.debtorSources.forEach((src,i) => {
          reqSrc("debtorSources",i,"sourceType");
          if (src.sourceType==="employment") {
            reqSrc("debtorSources",i,"employerName","Employer name is required");
            reqSrc("debtorSources",i,"payFrequency","Please select pay frequency");
            reqNSrc("debtorSources",i,"grossPerPeriod");
            reqNSrc("debtorSources",i,"netPerPeriod");
            reqSrc("debtorSources",i,"receiveBonus","Please answer yes or no");
            if (src.receiveBonus==="yes") {
              reqSrc("debtorSources",i,"bonusIncludedInIncome","Please answer yes or no");
              if (src.bonusIncludedInIncome==="no") { reqNSrc("debtorSources",i,"bonusGross"); reqNSrc("debtorSources",i,"bonusNet"); }
            }
          }
          if (src.sourceType==="selfEmployment") {
            reqSrc("debtorSources",i,"businessName");
            reqSrc("debtorSources",i,"businessType");
            reqNSrc("debtorSources",i,"businessGrossIncome");
            reqNSrc("debtorSources",i,"businessExpenses");
          }
        });
      }
      if (data.filingType==="joint"||data.filingType==="individual-nonfiling-spouse") {
        req("spouseWorkStatus","Please select spouse employment status");
        if (["employed","selfEmployed","both"].includes(data.spouseWorkStatus)) {
          data.spouseSources.forEach((src,i) => {
            reqSrc("spouseSources",i,"sourceType");
            if (src.sourceType==="employment") {
              reqSrc("spouseSources",i,"employerName"); reqSrc("spouseSources",i,"payFrequency");
              reqNSrc("spouseSources",i,"grossPerPeriod"); reqNSrc("spouseSources",i,"netPerPeriod");
              reqSrc("spouseSources",i,"receiveBonus","Please answer yes or no");
              if (src.receiveBonus==="yes") {
                reqSrc("spouseSources",i,"bonusIncludedInIncome","Please answer yes or no");
                if (src.bonusIncludedInIncome==="no") { reqNSrc("spouseSources",i,"bonusGross"); reqNSrc("spouseSources",i,"bonusNet"); }
              }
            }
            if (src.sourceType==="selfEmployment") {
              reqSrc("spouseSources",i,"businessName"); reqSrc("spouseSources",i,"businessType");
              reqNSrc("spouseSources",i,"businessGrossIncome"); reqNSrc("spouseSources",i,"businessExpenses");
            }
          });
        }
      }
    }
    if (s===3) {
      req("ownsRealEstate","Please answer yes or no");
      if (data.ownsRealEstate==="yes") {
        req("realPropType"); req("realPropAddress","Property address is required");
        reqN("realPropValue"); reqN("mortgageBalance");
        req("isOccupiedPrimary","Please indicate whether this is your primary residence");
        reqN("realPropMonthlyPayment","Please enter your monthly mortgage payment");
        if (data.realPropType==="Mobile Home") {
          req("payLotSpaceRent","Please indicate whether you pay lot or space rent");
          if (data.payLotSpaceRent==="yes") reqN("expLotSpaceRent","Please enter your monthly lot / space rent amount");
        }
        if (data.isOccupiedPrimary==="no") {
          req("payRentAtResidence","Please indicate whether you pay rent where you currently live");
          if (data.payRentAtResidence==="yes") reqN("rentAtResidence","Please enter your monthly rent amount");
        }
        req("hasHoa","Please indicate whether your property has an HOA");
        if (data.hasHoa==="yes") {
          if (!data.hoaName||!data.hoaName.trim()) errs["hoaName"]="HOA name is required";
          if (data.hoaMonthlyDues===""||data.hoaMonthlyDues===null||data.hoaMonthlyDues===undefined) errs["hoaMonthlyDues"]="Monthly dues amount is required";
          if (!data.hoaIsCurrent) errs["hoaIsCurrent"]="Please indicate whether your HOA dues are current";
          if (data.hoaIsCurrent==="no" && (data.hoaPastDueAmount===""||data.hoaPastDueAmount===null||data.hoaPastDueAmount===undefined)) errs["hoaPastDueAmount"]="Past due HOA amount is required";
        }
        req("hasLiens","Please indicate whether there are any additional liens");
        if (data.hasLiens==="yes") {
          (data.liens||[]).forEach((lien,i)=>{
            if (!lien.lienType) errs[`lien_${i}_lienType`]="Lien type required";
            if (!lien.lienHolder||!lien.lienHolder.trim()) errs[`lien_${i}_lienHolder`]="Lien holder name required";
            if (lien.balance===""||lien.balance===null||lien.balance===undefined) errs[`lien_${i}_balance`]="Balance required";
            if (!lien.isCurrent) errs[`lien_${i}_isCurrent`]="Please indicate whether this lien is current";
            if (lien.isCurrent==="no" && (lien.pastDueAmount===""||lien.pastDueAmount===null||lien.pastDueAmount===undefined)) errs[`lien_${i}_pastDueAmount`]="Past due amount required";
          });
        }
        req("secondProperty","Please answer yes or no");
        if (data.secondProperty==="yes") { req("secondPropAddress","Address required"); reqN("secondPropValue"); reqN("secondMortgage"); }
        req("hasInvestmentProperty","Please answer yes or no");
        req("hasRawLandTimeshare","Please answer yes or no");
        req("hasNameOnOthersRealEstate","Please answer yes or no");
      }
    }
    if (s===4) {
      req("hasVehicles","Please indicate whether you own any vehicles");
      if (data.hasVehicles==="yes") {
        data.vehicles.forEach((v,i)=>{
          if (!v.type) errs[`veh_${i}_type`]="Vehicle type required";
          if (!v.year||!v.year.trim()) errs[`veh_${i}_year`]="Year required";
          if (!v.make||!v.make.trim()) errs[`veh_${i}_make`]="Make required";
          if (!v.model||!v.model.trim()) errs[`veh_${i}_model`]="Model required";
          if (v.value===""||v.value===null||v.value===undefined) errs[`veh_${i}_value`]="Value required";
          if (!v.hasLoan) errs[`veh_${i}_hasLoan`]="Please answer yes or no";
          if (v.hasLoan==="yes") {
            if (v.loanBalance===""||v.loanBalance===null) errs[`veh_${i}_loanBalance`]="Loan balance required";
            if (v.monthlyPayment===""||v.monthlyPayment===null) errs[`veh_${i}_monthlyPayment`]="Monthly payment required";
          }
        });
      }
      req("hasBankAccounts","Please indicate whether you have any bank accounts");
      if (data.hasBankAccounts==="yes") {
        data.bankAccounts.forEach((acc,i)=>{
          if (!acc.bankName||!acc.bankName.trim()) errs[`ba_${i}_bankName`]="Bank name required";
          if (!acc.accountType) errs[`ba_${i}_accountType`]="Account type required";
          if (acc.balance===""||acc.balance===null||acc.balance===undefined) errs[`ba_${i}_balance`]="Balance required";
        });
      }
      req("hasRetirement","Please indicate whether you have any retirement accounts");
      req("hasLifeInsurance","Please answer yes or no");
      req("hasAnnuities","Please answer yes or no");
      req("hasPendingClaims","Please answer yes or no");
      if (data.hasPendingClaims==="yes") { req("pendingClaimsDesc","Please describe the claim"); }
      req("hasSsClaim","Please answer yes or no");
      req("hasMoneyOwed","Please answer yes or no");
      req("householdGoodsValue","Please enter a value or click 'I don't have this'");
      req("electronicsValue","Please enter a value or click 'I don't have this'");
      req("jewelryValue","Please enter a value or click 'I don't have this'");
      req("toolsValue","Please enter a value or click 'I don't have this'");
    }
    if (s===5) {
      req("mortgageIncludesInsurance","Please indicate if this is a mortgage or rent");
      if (data.mortgageIncludesInsurance && data.mortgageIncludesInsurance!=="renter") {
        req("mortgageCurrent","Please indicate whether your mortgage is current");
        if (data.mortgageCurrent==="no") reqN("mortgageArrears","Please enter the amount past due");
      }
      if (data.realPropType==="Mobile Home"&&data.payLotSpaceRent==="yes") reqN("expLotSpaceRent","Please enter your monthly lot / space rent");
      if (!((data.realPropMonthlyPayment&&data.isOccupiedPrimary==="yes")||data.rentAtResidence||(data.payRentAtResidence==="no")||(data.ownsRealEstate==="no"&&data.expRentMortgage!==""))) {
        reqN("expRentMortgage","Please enter your monthly rent or mortgage amount");
      }
    }
    if (s===6) {
      req("hasBusinessDebt","Please indicate whether you have any business debts");
      if (!data.hasMortgage) errs["securedDebt"]="Please indicate whether you have a mortgage";
      if (data.hasMortgage==="yes") reqN("securedDebt","Please enter your mortgage balance");
      ["creditCardDebt","medicalDebt","studentLoanDebt","taxDebt","personalLoanDebt","judgmentDebt","otherUnsecured"].forEach(f=>reqN(f));
      if (!data.childSupportCurrent) errs["childSupportCurrent"]="Please indicate whether you are current or behind on child support";
      if (data.childSupportCurrent==="behind" && !data.noChildSupportArrears) reqN("childSupportArrears");
      if (!data.alimonyCurrent) errs["alimonyCurrent"]="Please indicate whether you are current or behind on alimony";
      if (data.alimonyCurrent==="behind" && !data.noAlimonyArrears) reqN("alimonyArrears");
    }
    if (s===7) {
      req("priorBankruptcy","Please answer yes or no");
      if (data.priorBankruptcy==="yes") {
        data.priorBankruptcies.forEach((bk,i)=>{
          if (!bk.chapter) errs[`bk_${i}_chapter`]="Chapter is required";
          if (!bk.yearFiled||!bk.yearFiled.trim()) errs[`bk_${i}_yearFiled`]="Year filed is required";
          if (!bk.disposition) errs[`bk_${i}_disposition`]="Disposition is required";
        });
      }
      req("createdTrust","Please answer yes or no");
      if (data.createdTrust==="yes") req("trustDetails","Please provide details about the trust");
      req("transferredProperty","Please answer yes or no");
      req("preferentialPayments","Please answer yes or no");
      req("preferentialPaymentsInsider","Please answer yes or no");
      req("pendingLawsuits","Please answer yes or no");
      if (data.pendingLawsuits==="yes") req("lawsuitDetails","Please describe the lawsuit(s)");
      req("ownedBusiness","Please answer yes or no");
      if (data.ownedBusiness==="yes") req("businessDetails","Please describe the business");
      req("expectedRefund","Please answer yes, no, or don't know");
      req("dsoObligation","Please answer yes or no");
      req("recentLuxury","Please answer yes or no");
      req("garnishment","Please answer yes or no");
    }
    if (s===8) {
      req("piHasClaim","Please answer yes or no");
    }
    if (s===9) {
      if (!data.readInfoSheet) errs["readInfoSheet"]="You must read and acknowledge the Official Bankruptcy Information Sheet.";
      if (!data.confirmedAccurate) errs["confirmedAccurate"]="You must confirm the information is accurate before proceeding.";
    }
    return errs;
  };

  const handleContinue = () => {
    const errs = validateStep(step);
    setErrors(errs);
    setStep(s=>s+1);
    topRef.current?.scrollIntoView({behavior:"smooth"});
  };

  const submitIntake = async () => {
    setSubmitting(true);
    try {
      const ref = "BAI-" + Date.now().toString(36).toUpperCase();
      const n = (v) => parseFloat(v) || 0;

      // ── Residency ──────────────────────────────────────────────────────────
      const in_state_over_2_years =
        data.addressYears === "2+ years" ? true
        : data.addressYears ? false
        : null;

      const priorResidences = [];
      if (data.priorAddr1Street || data.priorAddr1City || data.priorAddr1State) {
        priorResidences.push({
          state:    data.priorAddr1State || "",
          city:     data.priorAddr1City  || "",
          street:   data.priorAddr1Street || "",
          fromDate: data.priorAddr1From  || "",
          toDate:   data.priorAddr1To    || "",
        });
      }

      // ── Income sources ────────────────────────────────────────────────────
      const income_sources_json = [
        ...(data.debtorSources || [])
          .filter(s => s.sourceType || s.employerName || s.businessName)
          .map(s => ({ ...s, owner: "debtor" })),
        ...(data.spouseSources || [])
          .filter(s => s.sourceType || s.employerName || s.businessName)
          .map(s => ({ ...s, owner: "spouse" })),
      ];

      // ── Real property ─────────────────────────────────────────────────────
      const real_properties = [];
      if (data.ownsRealEstate === "yes") {
        real_properties.push({
          address:       data.realPropAddress  || "",
          type:          data.realPropType     || "",
          value:         n(data.realPropValue),
          mortgageBalance: n(data.mortgageBalance),
          monthlyPayment:  n(data.realPropMonthlyPayment),
          intent:          data.realPropIntent || "",
          isCurrent:       data.mortgageCurrent || "",
          ownershipType:   data.realPropOwnershipType || "",
        });
      }
      if (data.secondProperty === "yes" && (data.secondPropAddress || data.secondPropValue)) {
        real_properties.push({
          address:        data.secondPropAddress  || "",
          type:           "secondary",
          value:          n(data.secondPropValue),
          mortgageBalance: n(data.secondMortgage),
          monthlyPayment:  n(data.secondMortgagePayment),
        });
      }

      // ── Aggregated balances ───────────────────────────────────────────────
      const bank_balance =
        data.hasBankAccounts === "no" || data.noBankAccounts
          ? 0
          : (data.bankAccounts || []).reduce((s, a) => s + n(a.balance), 0);

      const retirement_balance =
        data.hasRetirement === "no" || data.noRetirement
          ? 0
          : (data.retirementAccounts || []).reduce((s, a) => s + n(a.balance), 0);

      const life_insurance_cash_value =
        (data.lifePolicies || []).reduce((s, p) => s + n(p.cashValue), 0) || null;

      const firearm_value =
        (data.firearms || []).reduce((s, f) => s + n(f.value), 0) || null;

      // ── Expense buckets (source has line items; schema has category totals) ─
      const exp_utilities =
        n(data.expElectricGas) + n(data.expWaterSewer) +
        n(data.expPhone) + n(data.expInternet);
      const exp_transportation =
        n(data.expGasFuel) + n(data.expPublicTransit) + n(data.expCarMaintenance);
      const exp_insurance =
        n(data.expInsHealth) + n(data.expInsLife) + n(data.expInsVehicle) +
        n(data.expInsHome) + n(data.expInsDisability) + n(data.expInsOther);
      const exp_other =
        n(data.expHouseholdSupplies) + n(data.expClothing) + n(data.expPersonalCare) +
        n(data.expMisc) + n(data.expCharitable) + n(data.expRecreation) +
        n(data.expHomeMaintenance) + n(data.expAddlTaxes) + n(data.expAlimonyPaid) +
        n(data.expSupportOthers) + n(data.expGovFines) + n(data.expOther) +
        n(data.expChildEducation);

      // ── Vehicles ──────────────────────────────────────────────────────────
      const hasVehiclesYes = data.hasVehicles !== "no" && !data.noVehicles;
      const activeVehicles = hasVehiclesYes
        ? (data.vehicles || []).filter(v => v.make || v.year || v.model)
        : [];

      // ── Preferential payments (regular + insider combined) ─────────────────
      const all_preferential = [
        ...(data.preferentialPayments === "yes" ? (data.preferentialEntries || []) : []),
        ...(data.preferentialPaymentsInsider === "yes" ? (data.preferentialInsiderEntries || []) : []),
      ];

      const { data: submission } = await supabase.from("intake_submissions").insert({
        reference_number: ref,
        client_id:        clientId ?? null,
        status:           "pending_review",
        submitted_at:     new Date().toISOString(),

        // Filing
        filing_type:      data.filingType   || "",
        marital_status:   data.maritalStatus || "",

        // Residence
        street_address:   data.address  || "",
        city:             data.city     || "",
        state:            data.state    || "",
        zip_code:         data.zip      || "",
        county:           data.county   || null,
        address_years:    data.addressYears || null,
        in_state_over_2_years,
        prior_state:      data.priorDomicileState || null,
        prior_address:    [data.priorAddr1Street, data.priorAddr1City, data.priorAddr1State]
                            .filter(Boolean).join(", ") || null,
        prior_residences_json: priorResidences.length > 0 ? priorResidences : null,

        // Identity
        first_name:       data.firstName || "",
        last_name:        data.lastName  || "",
        email:            data.email     || "",
        phone:            data.phone     || null,
        spouse_first_name: data.spouseFirstName || null,
        spouse_last_name:  data.spouseLastName  || null,

        // Household
        num_dependents:   parseInt(data.numDependents) || 0,
        dependents_json:  (data.dependents || []).length > 0 ? data.dependents : null,

        // Income
        debtor_work_status: data.debtorWorkStatus || "",
        spouse_work_status: data.spouseWorkStatus || null,
        income_sources_json: income_sources_json.length > 0 ? income_sources_json : null,

        // Expenses
        exp_rent_mortgage: n(data.expRentMortgage),
        exp_utilities,
        exp_food:          n(data.expFood),
        exp_transportation,
        exp_healthcare:    n(data.expMedical),
        exp_insurance,
        exp_childcare:     n(data.expChildcare),
        exp_other,

        // Real property
        owns_real_estate:    data.ownsRealEstate === "yes",
        real_prop_address:   data.realPropAddress   || null,
        real_prop_value:     n(data.realPropValue)  || null,
        mortgage_balance:    n(data.mortgageBalance) || null,
        real_properties_json: real_properties.length > 0 ? real_properties : null,

        // Vehicles
        no_vehicles:     !hasVehiclesYes,
        num_vehicles:    activeVehicles.length,
        vehicles_json:   activeVehicles.length > 0 ? data.vehicles : null,

        // Personal property — financial
        bank_balance,
        retirement_balance,
        has_stocks:     data.hasStocks === "yes",
        stocks_value:   data.hasStocks === "yes" && data.stocksValue ? n(data.stocksValue) : null,
        has_crypto:     data.hasCrypto === "yes",
        crypto_value:   data.hasCrypto === "yes" && data.cryptoValue ? n(data.cryptoValue) : null,
        has_life_insurance:       data.hasLifeInsurance === "yes",
        life_insurance_cash_value: data.hasLifeInsurance === "yes" ? life_insurance_cash_value : null,
        has_firearms:    data.hasFirearms === "yes",
        firearm_value:   data.hasFirearms === "yes" ? firearm_value : null,
        has_collectibles: data.hasCollectibles === "yes",
        collectibles_value: data.hasCollectibles === "yes" && data.collectiblesValue
                              ? n(data.collectiblesValue) : null,
        household_goods_value: n(data.householdGoodsValue),
        other_property_desc:   data.otherPersonalPropDesc || null,

        // Debts
        secured_debt:      n(data.securedDebt),
        credit_card_debt:  n(data.creditCardDebt),
        medical_debt:      n(data.medicalDebt),
        student_loan_debt: n(data.studentLoanDebt),
        tax_debt:          n(data.taxDebt),
        personal_loan_debt: n(data.personalLoanDebt),
        other_unsecured:   n(data.otherUnsecured),

        // Financial history
        prior_bankruptcy:    data.priorBankruptcy === "yes",
        has_prior_bk:        data.priorBankruptcy === "yes",
        prior_bankruptcies_json: data.priorBankruptcy === "yes" && (data.priorBankruptcies || []).length > 0
                                   ? data.priorBankruptcies : null,
        pending_lawsuits:    data.pendingLawsuits === "yes",
        lawsuit_details:     data.lawsuitDetails || null,
        garnishment:         data.garnishment === "yes",
        garnishment_details: data.garnishment === "yes"
          ? [data.garnishmentCreditor, data.garnishmentMonthlyAmount ? `$${data.garnishmentMonthlyAmount}/mo` : ""]
              .filter(Boolean).join(", ") || null
          : null,
        has_transfers:       data.transferredProperty === "yes",
        transferred_property: data.transferredProperty === "yes",
        transfers_json:      data.transferredProperty === "yes" && (data.transfers || []).length > 0
                               ? data.transfers : null,
        has_preferential_payments: data.preferentialPayments === "yes" || data.preferentialPaymentsInsider === "yes",
        preferential_payments_json: all_preferential.length > 0 ? all_preferential : null,
        owned_business:  data.ownedBusiness === "yes",
        business_details: data.businessDetails || null,
        expected_refund:  data.expectedRefund === "yes",
        refund_amount:    data.expectedRefund === "yes" && data.refundAmount ? n(data.refundAmount) : null,
        recent_luxury:    data.recentLuxury === "yes",
        luxury_details:   data.luxuryDetails || null,
      }).select("id").single();
      if (clientId && submission?.id) {
        await supabase.from("clients").update({
          intake_id: submission.id,
          status: "intake_complete",
          last_activity: new Date().toISOString(),
          intake_completed_at: new Date().toISOString(),
        }).eq("id", clientId);

        const day2 = new Date();
        day2.setDate(day2.getDate() + 2);
        await supabase.from("follow_up_sequences").upsert({
          client_id: clientId,
          client_name: clientName || data.firstName + " " + data.lastName,
          client_email: clientEmail || data.email || "",
          client_phone: clientPhone || data.phone || "",
          stage: "day2",
          next_follow_up_at: day2.toISOString(),
          opted_out: false,
          notes: "Auto-created on intake submission",
          updated_at: new Date().toISOString(),
        }, { onConflict: "client_id" });

        await supabase.from("intake_notifications").insert({
          client_id: clientId,
          client_name: clientName || data.firstName + " " + data.lastName,
          client_email: clientEmail || data.email || "",
          client_phone: clientPhone || data.phone || "",
          intake_id: submission.id,
          reference_number: ref,
          status: "pending_contact",
          notified_at: new Date().toISOString(),
        });
      }
      if (submission?.id) {
        await supabase.from("intake_chats")
          .update({ draft_id: submission.id })
          .eq("session_id", sessionId)
          .is("draft_id", null);
      }
      setSubmitRef(ref);
      setSubmitted(true);
    } catch(err) {
      const ref = "BAI-" + Date.now().toString(36).toUpperCase();
      setSubmitRef(ref);
      setSubmitted(true);
    }
    setSubmitting(false);
  };

  const submitPiIntake = async () => {
    if (data.piHasClaim !== "yes" || data.piHasAttorney === "yes" || data.piSubmitted) return;
    setPiSubmitStatus("submitting");
    try {
      await supabase.from("pi_intake_submissions").insert({
        intake_id: null,
        client_id: clientId ?? null,
        client_name: clientName || (data.firstName + " " + data.lastName).trim() || "",
        client_email: clientEmail || data.email || "",
        client_phone: clientPhone || data.phone || "",
        reference_number: "PI-" + Date.now().toString(36).toUpperCase(),
        date_of_loss: data.piDateOfLoss || "",
        incident_description: data.piIncidentDescription || "",
        incident_location: data.piIncidentLocation || "",
        at_fault_party_name: data.piAtFaultName || "",
        at_fault_party_phone: data.piAtFaultPhone || "",
        at_fault_party_insurance: data.piAtFaultInsurance || "",
        other_parties: data.piOtherParties ? [{ description: data.piOtherParties }] : [],
        police_report_filed: data.piPoliceReport === "yes",
        police_report_number: data.piPoliceReportNumber || "",
        police_department: data.piPoliceDepartment || "",
        was_injured: data.piWasInjured === "yes",
        injury_description: data.piInjuryDescription || "",
        medical_treatment_received: data.piMedicalTreatment === "yes",
        medical_provider: data.piMedicalProvider || "",
        has_attorney: false,
        property_damage: data.piPropertyDamage === "yes",
        property_damage_description: data.piPropertyDamageDesc || "",
        additional_notes: data.piAdditionalNotes || "",
        status: "pending_review",
      });
      u("piSubmitted", true);
      setPiSubmitStatus("submitted");
    } catch(err) {
      setPiSubmitStatus("error");
    }
  };

  const renderSection = () => {
    const fmtD = n => n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});

    switch(step) {
      case 0: return (
        <div>
          <SectionCard title="Who is filing?" icon="👤">
            <Field label="Marital Status" error={e("maritalStatus")}>
              <RadioGroup name="maritalStatus" current={data.maritalStatus} onChange={v=>{
                u("maritalStatus",v);
                if (v==="single" || v==="divorced" || v==="widowed") u("filingType","individual");
                else if (v==="separated") u("filingType","individual");
                else u("filingType","");
              }} error={e("maritalStatus")}
                options={[
                  {value:"single",    label:"Single — I am not currently married"},
                  {value:"married",   label:"Married"},
                  {value:"separated", label:"Legally Separated"},
                  {value:"divorced",  label:"Divorced"},
                  {value:"widowed",   label:"Widowed"},
                ]}/>
            </Field>
            {data.maritalStatus && data.maritalStatus !== "single" && data.maritalStatus !== "married" && (
              <div className="mt-2 p-3 bg-slate-700/50 rounded-lg">
                <p className="text-xs text-slate-400 leading-relaxed">
                  {data.maritalStatus === "separated"
                    ? "Legal separation may affect community property treatment. Your attorney will advise on how your separation agreement impacts the filing."
                    : data.maritalStatus === "divorced"
                    ? "If your divorce was finalized before filing, you will file as an individual. Please ensure your divorce decree is available for your attorney's review."
                    : "Widowed filers file as individuals. If your spouse passed within the last 2 years, your attorney will review eligibility for certain joint filing provisions."}
                </p>
              </div>
            )}

            {data.maritalStatus==="married" && (
              <Field label="Filing Type" error={e("filingType")}>
                <RadioGroup name="filingType" current={data.filingType} onChange={v=>u("filingType",v)} error={e("filingType")}
                  options={[{value:"joint",label:"Filing jointly with my spouse"},{value:"individual-nonfiling-spouse",label:"Filing individually — my spouse is not filing"}]}/>
              </Field>
            )}

            {data.filingType==="individual-nonfiling-spouse" && (
              <>
                {COMMUNITY_PROPERTY_STATES.includes(data.state) ? (
                  <div className="mb-4 p-4 bg-red-500/10 border border-red-500/40 rounded-xl">
                    <div className="flex gap-3 items-start">
                      <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                      <div>
                        <p className="text-sm font-bold text-red-300 mb-1">Community Property State — Full Disclosure Required</p>
                        <p className="text-xs text-red-200/80 leading-relaxed mb-2">
                          <strong>{data.state}</strong> is a community property state. Because you are married and filing individually, <strong>you are required by law to disclose all community property assets and interests</strong> — including your non-filing spouse's income, all property acquired during the marriage, and any jointly held debts — on your bankruptcy schedules.
                        </p>
                        <p className="text-xs text-red-200/60 leading-relaxed">
                          Failure to disclose community property is a federal crime. Throughout this questionnaire you will be asked to provide information for all community property assets and income, even if held solely in your spouse's name.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                    <div className="flex gap-3 items-start">
                      <svg className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                      <div>
                        <p className="text-xs font-semibold text-amber-300 mb-1">Non-filing spouse notice</p>
                        <p className="text-xs text-amber-200/70 leading-relaxed">
                          {data.state ? `${data.state} is not a community property state. However, your` : "Depending on your state, your"} non-filing spouse's income is still required for the means test. If you reside in a community property state (Arizona, California, Idaho, Louisiana, Nevada, New Mexico, Texas, Washington, or Wisconsin), you will also be required to disclose all community property assets and interests. Your attorney will advise on full disclosure requirements.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="First Name" error={e("firstName")}><Input value={data.firstName} onChange={v=>u("firstName",v)} placeholder="First" hasError={!!e("firstName")}/></Field>
              <Field label="Last Name" error={e("lastName")}><Input value={data.lastName} onChange={v=>u("lastName",v)} placeholder="Last" hasError={!!e("lastName")}/></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email Address" error={e("email")}><Input type="email" value={data.email} onChange={v=>u("email",v)} placeholder="your@email.com" hasError={!!e("email")}/></Field>
              <Field label="Phone Number" error={e("phone")}><Input type="tel" value={data.phone} onChange={v=>u("phone",v)} placeholder="(555) 555-5555" hasError={!!e("phone")}/></Field>
            </div>
            {(data.filingType==="joint"||data.filingType==="individual-nonfiling-spouse") && <>
              <p className="text-xs text-slate-400 mb-2">{data.filingType==="joint"?"Co-debtor (spouse):":"Non-filing spouse:"}</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Spouse First" error={e("spouseFirstName")}><Input value={data.spouseFirstName} onChange={v=>u("spouseFirstName",v)} placeholder="First" hasError={!!e("spouseFirstName")}/></Field>
                <Field label="Spouse Last" error={e("spouseLastName")}><Input value={data.spouseLastName} onChange={v=>u("spouseLastName",v)} placeholder="Last" hasError={!!e("spouseLastName")}/></Field>
              </div>
            </>}
          </SectionCard>
          <SectionCard title="Current Address" icon="🏠">
            <Field label="Street Address" error={e("address")}>
              <Input value={data.address} onChange={v=>u("address",v)} placeholder="123 Main Street" hasError={!!e("address")}/>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="City" error={e("city")}>
                <Input value={data.city} onChange={v=>u("city",v)} placeholder="City" hasError={!!e("city")}/>
              </Field>
              <Field label="ZIP Code" error={e("zip")}>
                <Input value={data.zip} onChange={v=>u("zip",v)} placeholder="85001" hasError={!!e("zip")}/>
              </Field>
            </div>
            <Field label="State of Residence" error={e("state")}>
              <Select value={data.state} onChange={v=>{u("state",v);u("county","");}} options={US_STATES} placeholder="Select state..." hasError={!!e("state")}/>
            </Field>
            <Field label="County" error={e("county")}>
              {COUNTIES_BY_STATE[data.state]
                ? <Select value={data.county} onChange={v=>u("county",v)} options={COUNTIES_BY_STATE[data.state]} placeholder="Select county..." hasError={!!e("county")}/>
                : <Input value={data.county} onChange={v=>u("county",v)} placeholder={data.state?"Enter county name":"Select a state first"} hasError={!!e("county")}/>}
            </Field>
            <Field label="How long at current address?" error={e("addressYears")}>
              <Select value={data.addressYears} onChange={v=>u("addressYears",v)} hasError={!!e("addressYears")}
                options={["Less than 91 days","91 days – 6 months","6 months – 2 years","2+ years"]} placeholder="Select..."/>
            </Field>
            {data.addressYears==="Less than 91 days" && <p className="text-amber-400 text-xs mt-1">⚠️ Venue may be disputed — prior state's exemptions may apply.</p>}
          </SectionCard>
          {needsPriorAddresses() && (
            <SectionCard title="Prior Domicile State" icon="📍">
              <div className="mb-4 p-3 bg-amber-400/10 border border-amber-400/30 rounded-lg">
                <p className="text-amber-400 text-xs font-semibold mb-1">⚖️ Exemption Domicile Rule — 11 U.S.C. § 522(b)(3)</p>
                <p className="text-slate-300 text-xs leading-relaxed">
                  Because you have lived in <strong className="text-white">{data.state||"your current state"}</strong> for less than 2 years, federal law determines your exemptions based on where you lived during a specific prior period.
                </p>
              </div>
              <div className="bg-slate-800/80 border border-slate-600 rounded-xl p-4 mb-4">
                <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Relevant Lookback Period</p>
                <p className="text-white font-semibold text-base">{domicileWindow.label}</p>
                <p className="text-xs text-slate-400 mt-1">
                  This is the 180-day window ending 730 days before today. The state where you lived for the <strong className="text-white">majority</strong> of this period determines which state's exemptions apply.
                </p>
              </div>
              <Field label={`Where did you live for most of the time between ${domicileWindow.labelShort}?`} error={e("priorDomicileState")}>
                <Select value={data.priorDomicileState} onChange={v=>u("priorDomicileState",v)} options={US_STATES} placeholder="Select state..." hasError={!!e("priorDomicileState")}/>
              </Field>
              {data.priorDomicileState && data.priorDomicileState !== data.state && (() => {
                const rule = NON_RESIDENT_RULES[data.priorDomicileState];
                const exactNote = rule ? rule.note : `${data.priorDomicileState} — exemption data not yet in our database; your attorney will confirm the applicable exemption set.`;
                return (
                  <div className="mt-2 p-3 bg-amber-400/10 border border-amber-400/30 rounded-lg">
                    <p className="text-amber-400 text-xs font-semibold mb-1">⚠️ Prior State — Exemption Rule (11 U.S.C. § 522(b)(3))</p>
                    <p className="text-slate-300 text-xs leading-relaxed">{exactNote}</p>
                  </div>
                );
              })()}
              {data.priorDomicileState && data.priorDomicileState === data.state && (
                <div className="mt-2 p-3 bg-green-400/10 border border-green-400/30 rounded-lg">
                  <p className="text-green-400 text-xs font-semibold">✓ Same State — {data.state} exemptions expected to apply.</p>
                </div>
              )}
            </SectionCard>
          )}
          {data.addressYears && <ExemptionPreviewCard data={data} />}
          <ErrorBanner errors={errors}/>
        </div>
      );

      case 1: return (
        <div>
          <SectionCard title="Household Composition" icon="👨‍👩‍👧">
            <Field label="Number of Dependents" hint="Children or others financially dependent on you">
              <Select value={data.numDependents} onChange={v=>{
                const n=parseInt(v)||0;
                const arr=Array.from({length:n},(_,i)=>data.dependents[i]||{age:"",relationship:"",stillLivesHere:"",contributesFinancially:"",monthlyContribution:""});
                setData(d=>({...d,numDependents:v,dependents:arr}));
              }} options={["0","1","2","3","4","5","6","7","8+"]}/>
            </Field>
            {parseInt(data.numDependents)>0 && (
              <div className="mt-2 space-y-3">
                {data.dependents.map((dep,i)=>(
                  <div key={i} className="bg-slate-900/60 border border-slate-600 rounded-xl p-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Dependent {i+1}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Age" error={errors[`dep_${i}_age`]}>
                        <Select value={dep.age} onChange={v=>{
                          const arr=[...data.dependents];
                          arr[i]={...arr[i],age:v};
                          setData(d=>({...d,dependents:arr}));
                        }} hasError={!!errors[`dep_${i}_age`]}
                        options={["Under 1","1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","20","21","22","23","24","25","26","27","28","29","30","31","32","33","34","35","36","37","38","39","40","41","42","43","44","45","46","47","48","49","50","51","52","53","54","55","56","57","58","59","60","61","62","63","64","65","66","67","68","69","70","71","72","73","74","75","76","77","78","79","80","81","82","83","84","85","86","87","88","89","90","91","92","93","94","95+"]}
                        placeholder="Select age..."/>
                      </Field>
                      <Field label="Relationship" error={errors[`dep_${i}_relationship`]}>
                        <Select value={dep.relationship} onChange={v=>{
                          const arr=[...data.dependents];
                          arr[i]={...arr[i],relationship:v};
                          setData(d=>({...d,dependents:arr}));
                        }} hasError={!!errors[`dep_${i}_relationship`]}
                        options={["Son","Daughter","Stepson","Stepdaughter","Grandson","Granddaughter","Mother","Father","Stepmother","Stepfather","Grandmother","Grandfather","Sister","Brother","Aunt","Uncle","Niece","Nephew","Significant Other","Friend","Other"]}
                        placeholder="Select relationship..."/>
                      </Field>
                    </div>
                    <div className="mt-3">
                      <Field label="Does this person currently live in your household?" error={errors[`dep_${i}_stillLivesHere`]}>
                        <RadioGroup name={`dep_${i}_stillLivesHere`} current={dep.stillLivesHere} onChange={v=>{
                          const arr=[...data.dependents]; arr[i]={...arr[i],stillLivesHere:v}; setData(d=>({...d,dependents:arr}));
                        }} error={errors[`dep_${i}_stillLivesHere`]}
                          options={[{value:"yes",label:"Yes — lives with me"},{value:"no",label:"No — does not live with me"}]}/>
                      </Field>
                    </div>
                    <div className="mt-3">
                      <Field label="Does this person contribute financially to the household?" error={errors[`dep_${i}_contributesFinancially`]}>
                        <RadioGroup name={`dep_${i}_contributesFinancially`} current={dep.contributesFinancially} onChange={v=>{
                          const arr=[...data.dependents]; arr[i]={...arr[i],contributesFinancially:v, monthlyContribution: v==="no"?"":arr[i].monthlyContribution}; setData(d=>({...d,dependents:arr}));
                        }} error={errors[`dep_${i}_contributesFinancially`]}
                          options={[{value:"yes",label:"Yes — they contribute income or money toward household expenses"},{value:"no",label:"No — they do not contribute financially"}]}/>
                      </Field>
                      {dep.contributesFinancially==="yes" && (
                        <Field label="Monthly amount contributed" error={errors[`dep_${i}_monthlyContribution`]}>
                          <Input type="number" value={dep.monthlyContribution} onChange={v=>{
                            const arr=[...data.dependents]; arr[i]={...arr[i],monthlyContribution:v}; setData(d=>({...d,dependents:arr}));
                          }} placeholder="e.g. 500" hasError={!!errors[`dep_${i}_monthlyContribution`]}/>
                        </Field>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 p-3 bg-slate-700/50 rounded-lg">
              <p className="text-xs text-slate-400">Household Size for Means Test:</p>
              <p className="text-xl font-serif text-amber-400 font-bold">{parseInt(data.numDependents||0)+(data.filingType==="joint"||data.filingType==="individual-nonfiling-spouse"?2:1)} people</p>
            </div>
          </SectionCard>
          <ErrorBanner errors={errors}/>
        </div>
      );

      case 2: {
        const debtorName = data.firstName ? `${data.firstName} ${data.lastName}`.trim() : "Debtor";
        const spouseName = data.spouseFirstName ? `${data.spouseFirstName} ${data.spouseLastName}`.trim() : (data.filingType==="joint"?"Spouse":"Non-Filing Spouse");
        const hasSpouse = data.filingType==="joint"||data.filingType==="individual-nonfiling-spouse";
        const hhSize = parseInt(data.numDependents||0)+(hasSpouse?2:1);
        const cmiExcluded = (parseFloat(data.dSsRetirement)||0)+(parseFloat(data.dSsDisability)||0)+(parseFloat(data.dVeterans)||0)+(parseFloat(data.sSsRetirement)||0)+(parseFloat(data.sSsDisability)||0)+(parseFloat(data.sVeterans)||0);
        // Veterans Retirement IS CMI — intentionally not excluded above
        const cmiMT = Math.max(0, totalIncome()-cmiExcluded);
        const mtMonthly = data.avgMonthly6 ? parseFloat(data.avgMonthly6) : cmiMT;
        const mtAnnual = mtMonthly*12;
        const median = getMedian(data.state, hhSize);
        const passes = median!==null ? mtAnnual<=median : null;
        const overMedian = passes === false;
        const fmt = n => n.toLocaleString("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0});
        const fmt2 = n => n.toLocaleString("en-US",{style:"currency",currency:"USD",minimumFractionDigits:2,maximumFractionDigits:2});

        const dGrossWages = monthlyGrossWages();
        const sGrossWages = spouseMonthlyGrossWages();
        const dNetWages = monthlyNetWages();
        const sNetWages = spouseMonthlyNetWages();
        const dBizGross = monthlyBusinessGross();
        const sBizGross = spouseMonthlyBusinessGross();
        const dBizExp = monthlyBusinessOpExp();
        const sBizExp = spouseMonthlyBusinessOpExp();
        const dBizNet = Math.max(0, dBizGross - dBizExp);
        const sBizNet = Math.max(0, sBizGross - sBizExp);
        const dGovOther = debtorGovOther();
        const sGovOther = spouseGovOther();

        const dWageDeductions = Math.max(0, dGrossWages - dNetWages);
        const sWageDeductions = Math.max(0, sGrossWages - sNetWages);

        const ch7DMI = ch7NetMonthlyIncome() - totalExpenses();
        const ch13DMI = ch13NetMonthlyIncome() - totalExpenses();

        const meansTestIncome = mtMonthly;
        const ssExcluded = (parseFloat(data.dSsRetirement)||0)+(parseFloat(data.dSsDisability)||0)+(parseFloat(data.dVeterans)||0)+(parseFloat(data.sSsRetirement)||0)+(parseFloat(data.sSsDisability)||0)+(parseFloat(data.sVeterans)||0);
        // ssExcluded = non-CMI; Veterans Retirement is CMI and not excluded

        return (
          <div>
            <PersonIncomeSection
              who="debtorSources" label="Debtor" personName={debtorName}
              workStatusKey="debtorWorkStatus" workStatus={data.debtorWorkStatus}
              sources={data.debtorSources} monthlyGrossTotal={monthlyGross()}
              onStatusChange={v=>u("debtorWorkStatus",v)} onUpdate={uSrc} onError={eSrc}
              onAdd={addSrc} onRemove={removeSrc} periodToMonthly={periodToMonthly} isSpouse={false}/>
            {hasSpouse && (
              <PersonIncomeSection
                who="spouseSources" label={data.filingType==="joint"?"Spouse / Co-Debtor":"Non-Filing Spouse"} personName={spouseName}
                workStatusKey="spouseWorkStatus" workStatus={data.spouseWorkStatus}
                sources={data.spouseSources} monthlyGrossTotal={spouseMonthlyGross()}
                onStatusChange={v=>u("spouseWorkStatus",v)} onUpdate={uSrc} onError={eSrc}
                onAdd={addSrc} onRemove={removeSrc} periodToMonthly={periodToMonthly} isSpouse={true}/>
            )}
            {[
              {p:"d", name:debtorName, show:true},
              {p:"s", name:spouseName, show:hasSpouse},
            ].filter(x=>x.show).map(({p,name})=>(
              <div key={p} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 mb-4">
                <p className="font-serif text-base font-bold text-white mb-1">{name}</p>
                <p className="text-xs text-slate-400 mb-4">Government Benefits &amp; Other Income — enter an amount or click "I do not have" to skip</p>
                {GOV_OTHER_FIELDS.filter(f=>f.section==="gov").map(({key,label},idx,arr)=>(
                  <GovIncomeRow key={key} label={label} fieldKey={`${p}${key}`}
                    value={data[`${p}${key}`]} onChange={v=>u(`${p}${key}`,v)}
                    isNA={!!notApplicable[`${p}${key}`]} onToggleNA={toggleNA}/>
                ))}
                <hr className="border-slate-700 my-4"/>
                {GOV_OTHER_FIELDS.filter(f=>f.section==="other").map(({key,label})=>(
                  <GovIncomeRow key={key} label={label} fieldKey={`${p}${key}`}
                    value={data[`${p}${key}`]} onChange={v=>u(`${p}${key}`,v)}
                    isNA={!!notApplicable[`${p}${key}`]} onToggleNA={toggleNA}/>
                ))}
              </div>
            ))}
            {dependentContributionsTotal() > 0 && (
              <div className="mb-4 p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                <p className="text-xs font-semibold text-blue-300 mb-1">Household Member Contributions Included</p>
                <div className="space-y-1">
                  {data.dependents.filter(d=>d.contributesFinancially==="yes" && parseFloat(d.monthlyContribution)>0).map((d,i)=>(
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-slate-400">{d.relationship||"Dependent"} (age {d.age})</span>
                      <span className="text-white font-medium">${(parseFloat(d.monthlyContribution)||0).toLocaleString()}/mo</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs font-semibold border-t border-slate-700 pt-1 mt-1">
                    <span className="text-slate-300">Total contributions</span>
                    <span className="text-amber-400">${dependentContributionsTotal().toLocaleString()}/mo</span>
                  </div>
                </div>
              </div>
            )}
            <div className="bg-slate-900 border border-amber-400/30 rounded-2xl p-4 mb-4">
              <p className="text-xs text-slate-400 uppercase tracking-widest mb-3">Income Summary</p>
              <div className={`grid gap-3 mb-3 ${hasSpouse?"grid-cols-3":"grid-cols-2"}`}>
                <div className="bg-slate-800 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-400 truncate mb-1">{debtorName}</p>
                  <p className="text-sm font-serif font-bold text-amber-400">${fmtD(monthlyGross()+debtorGovOther())}</p>
                  <p className="text-xs text-slate-500">total/mo</p>
                </div>
                {hasSpouse && (
                  <div className="bg-slate-800 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-400 truncate mb-1">{spouseName}</p>
                    <p className="text-sm font-serif font-bold text-amber-400">${fmtD(spouseMonthlyGross()+spouseGovOther())}</p>
                    <p className="text-xs text-slate-500">total/mo</p>
                  </div>
                )}
                <div className="bg-slate-800 rounded-xl p-3 text-center border border-amber-400/20">
                  <p className="text-xs text-slate-400 mb-1">{hasSpouse?"Combined":"Total"}</p>
                  <p className="text-xl font-serif font-bold text-amber-400">${fmtD(totalIncome())}</p>
                  <p className="text-xs text-slate-500">total/mo</p>
                </div>
              </div>
            </div>
            <SectionCard title="Chapter 7 & 13 Eligibility / DMI" icon="📊">
              <div className="mb-4 p-3 bg-slate-800/60 border border-slate-600 rounded-xl">
                <p className="text-xs font-semibold text-slate-300 mb-1">How Disposable Monthly Income (DMI) is calculated</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  <strong className="text-slate-300">Chapter 7 DMI</strong> uses net income — gross wages minus taxes/deductions, plus net business income (gross revenue minus operating expenses), plus retirement and other income sources — minus monthly expenses.<br/>
                  <strong className="text-slate-300">Chapter 13 DMI</strong> uses gross business revenue (operating expenses are NOT deducted per 11 U.S.C. § 1325), plus net wages and other income, minus expenses. This determines plan payment ability.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-400 text-[10px] font-extrabold">7</span>
                    </div>
                    <p className="text-xs font-bold text-slate-300 uppercase tracking-wide">Chapter 7 DMI</p>
                  </div>
                  <div className="space-y-1.5 text-xs mb-3">
                    <div className="flex justify-between text-slate-400"><span>Net wages (after deductions)</span><span className="text-slate-300 font-medium">{fmt2(dNetWages+sNetWages)}</span></div>
                    <div className="flex justify-between text-slate-400"><span>Net business income</span><span className="text-slate-300 font-medium">{fmt2(dBizNet+sBizNet)}</span></div>
                    {dBizExp+sBizExp > 0 && <div className="flex justify-between text-slate-500 pl-2"><span>− Business op. expenses</span><span className="text-red-400/70">({fmt2(dBizExp+sBizExp)})</span></div>}
                    <div className="flex justify-between text-slate-400"><span>Retirement / other income</span><span className="text-slate-300 font-medium">{fmt2(dGovOther+sGovOther)}</span></div>
                    <div className="border-t border-slate-700 pt-1 flex justify-between text-slate-300 font-semibold"><span>Total net income</span><span>{fmt2(ch7NetMonthlyIncome())}</span></div>
                    <div className="flex justify-between text-slate-400"><span>− Monthly expenses</span><span className="text-red-400/80">({fmt2(totalExpenses())})</span></div>
                  </div>
                  <div className={`rounded-lg p-2.5 text-center ${ch7DMI>=0?"bg-green-500/10 border border-green-500/30":"bg-red-500/10 border border-red-500/30"}`}>
                    <p className="text-[10px] text-slate-400 mb-0.5">Ch. 7 Monthly DMI</p>
                    <p className={`text-xl font-serif font-bold ${ch7DMI>=0?"text-green-400":"text-red-400"}`}>{fmt2(ch7DMI)}</p>
                    <p className="text-[10px] mt-0.5 text-slate-500">{ch7DMI<=300?"Likely qualifies for Ch. 7":"High DMI — attorney will review"}</p>
                  </div>
                </div>

                <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-amber-400 text-[10px] font-extrabold">13</span>
                    </div>
                    <p className="text-xs font-bold text-slate-300 uppercase tracking-wide">Chapter 13 DMI</p>
                  </div>
                  <div className="space-y-1.5 text-xs mb-3">
                    <div className="flex justify-between text-slate-400"><span>Net wages (after deductions)</span><span className="text-slate-300 font-medium">{fmt2(dNetWages+sNetWages)}</span></div>
                    <div className="flex justify-between text-slate-400"><span>Gross business revenue</span><span className="text-slate-300 font-medium">{fmt2(dBizGross+sBizGross)}</span></div>
                    {dBizExp+sBizExp > 0 && <div className="flex justify-between text-slate-500 pl-2"><span>Op. expenses (not deducted)</span><span className="text-slate-600 line-through">{fmt2(dBizExp+sBizExp)}</span></div>}
                    <div className="flex justify-between text-slate-400"><span>Retirement / other income</span><span className="text-slate-300 font-medium">{fmt2(dGovOther+sGovOther)}</span></div>
                    <div className="border-t border-slate-700 pt-1 flex justify-between text-slate-300 font-semibold"><span>Total disposable income</span><span>{fmt2(ch13NetMonthlyIncome())}</span></div>
                    <div className="flex justify-between text-slate-400"><span>− Monthly expenses</span><span className="text-red-400/80">({fmt2(totalExpenses())})</span></div>
                  </div>
                  <div className={`rounded-lg p-2.5 text-center ${ch13DMI>=0?"bg-amber-500/10 border border-amber-500/30":"bg-red-500/10 border border-red-500/30"}`}>
                    <p className="text-[10px] text-slate-400 mb-0.5">Ch. 13 Monthly DMI</p>
                    <p className={`text-xl font-serif font-bold ${ch13DMI>=0?"text-amber-400":"text-red-400"}`}>{fmt2(ch13DMI)}</p>
                    <p className="text-[10px] mt-0.5 text-slate-500">{ch13DMI>0?`Est. plan payment ~${fmt2(ch13DMI)}/mo`:"Negative — attorney will review"}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl overflow-hidden border border-slate-700 mb-4">
                <div className="px-3 pt-3 pb-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Means Test — CMI vs. State Median (Form 122A)</p>
                  <p className="text-[11px] text-slate-500 mb-3">The Means Test uses gross wages plus all income <em>except</em> Social Security and VA benefits — business operating expenses are not deducted for the CMI calculation.</p>
                </div>
                <div className="p-3 grid grid-cols-2 gap-3">
                  <div className="bg-slate-800 rounded-lg p-3">
                    <p className="text-xs text-slate-400 mb-1">Annualized Means Test Income (CMI)</p>
                    <p className="text-lg font-serif font-bold text-white">{fmt(mtAnnual)}</p>
                    <p className="text-[10px] text-slate-500 mt-1">{fmt2(mtMonthly)}/mo × 12</p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-3">
                    <p className="text-xs text-slate-400 mb-1">State Median ({hhSize}-person HH)</p>
                    {median!==null
                      ? <><p className="text-lg font-serif font-bold text-white">{fmt(median)}</p><p className="text-xs text-slate-500">{data.state} — {MEDIAN_DATE}</p></>
                      : <p className="text-sm text-slate-500">Select a state on step 1</p>}
                  </div>
                </div>
                {ssExcluded > 0 && (
                  <div className="mx-3 mb-3 p-2.5 rounded-lg bg-slate-800/40 border border-slate-700">
                    <p className="text-[10px] text-slate-500">SS/VA excluded from CMI: <span className="text-slate-300 font-semibold">{fmt2(ssExcluded)}/mo</span> — these are not counted in the Means Test per 11 U.S.C. § 101(10A)</p>
                  </div>
                )}
                {median!==null && (
                  <div className={`mx-3 mb-3 p-3 rounded-lg border ${passes?"bg-green-500/8 border-green-500/30":"bg-amber-500/8 border-amber-500/30"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold ${passes?"text-green-400":"text-amber-400"}`}>
                        {passes ? "Below Median — Presumptive Ch. 7 Qualification" : "Above Median — Full Means Test Required"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {passes
                        ? `Your CMI of ${fmt(mtAnnual)} is below the ${data.state} median of ${fmt(median)} for a ${hhSize}-person household. You presumptively pass the Means Test.`
                        : `Your CMI of ${fmt(mtAnnual)} exceeds the ${data.state} median of ${fmt(median)} for a ${hhSize}-person household by ${fmt(mtAnnual-median)}. The attorney will apply the full expense deduction analysis (Form 122A-2).`}
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700/50">
                  <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
                  <span className="text-sm font-bold text-white">Income &amp; Schedule I</span>
                </div>
                <div className="px-4 py-4 space-y-4">

                  {overMedian && (
                    <div className="flex items-start gap-2 text-[10px] bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 text-amber-300">
                      <svg className="w-3 h-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.998L13.732 4c-.77-1.332-2.694-1.332-3.464 0L3.34 16.002c-.77 1.331.192 2.998 1.732 2.998z"/></svg>
                      <span><span className="font-bold">Presumptive Ch. 13:</span> Over median — self-employment income shown as gross (no Schedule C deductions per 11 U.S.C. § 1325(b))</span>
                    </div>
                  )}

                  {data.debtorSources.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Debtor Income</p>
                      <div className="space-y-1 bg-slate-800/30 rounded-xl border border-slate-700/40 p-3">
                        {data.debtorSources.map((src, i) => {
                          const isSE = src.sourceType !== "employment";
                          const amt = isSE && overMedian
                            ? (parseFloat(src.businessGrossIncome)||0)
                            : isSE
                              ? Math.max(0, (parseFloat(src.businessGrossIncome)||0) - (parseFloat(src.businessExpenses)||0))
                              : srcMonthlyGross(src) + srcBonusGross(src);
                          const label = src.employerName || src.businessName || `Source ${i+1}`;
                          return (
                            <div key={i} className="flex justify-between items-center text-xs">
                              <div className="flex items-center gap-1.5 truncate pr-2">
                                {isSE && <span className="text-[9px] bg-orange-500/20 text-orange-300 px-1 py-0.5 rounded font-bold flex-shrink-0">SELF-EMPL</span>}
                                <span className="text-slate-300 truncate">{label}</span>
                              </div>
                              <span className="text-white font-semibold flex-shrink-0">{fmt2(amt)}</span>
                            </div>
                          );
                        })}
                        <div className="flex justify-between items-center text-xs pt-1.5 border-t border-slate-700/50 mt-0.5">
                          <span className="text-slate-400 font-semibold">Debtor Subtotal</span>
                          <span className="text-white font-bold">{fmt2(
                            data.debtorSources.reduce((s, src) => {
                              const isSE = src.sourceType !== "employment";
                              return s + (isSE && overMedian
                                ? (parseFloat(src.businessGrossIncome)||0)
                                : isSE
                                  ? Math.max(0, (parseFloat(src.businessGrossIncome)||0) - (parseFloat(src.businessExpenses)||0))
                                  : srcMonthlyGross(src) + srcBonusGross(src));
                            }, 0)
                          )}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {hasSpouse && data.spouseSources.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                        {data.filingType === "individual-nonfiling-spouse" ? "Non-Filing Spouse Income" : "Spouse Income"}
                      </p>
                      <div className="space-y-1 bg-slate-800/30 rounded-xl border border-slate-700/40 p-3">
                        {data.spouseSources.map((src, i) => {
                          const isSE = src.sourceType !== "employment";
                          const amt = isSE && overMedian
                            ? (parseFloat(src.businessGrossIncome)||0)
                            : isSE
                              ? Math.max(0, (parseFloat(src.businessGrossIncome)||0) - (parseFloat(src.businessExpenses)||0))
                              : srcMonthlyGross(src) + srcBonusGross(src);
                          const label = src.employerName || src.businessName || `Source ${i+1}`;
                          return (
                            <div key={i} className="flex justify-between items-center text-xs">
                              <div className="flex items-center gap-1.5 truncate pr-2">
                                {isSE && <span className="text-[9px] bg-orange-500/20 text-orange-300 px-1 py-0.5 rounded font-bold flex-shrink-0">SELF-EMPL</span>}
                                <span className="text-slate-300 truncate">{label}</span>
                              </div>
                              <span className="text-white font-semibold flex-shrink-0">{fmt2(amt)}</span>
                            </div>
                          );
                        })}
                        <div className="flex justify-between items-center text-xs pt-1.5 border-t border-slate-700/50 mt-0.5">
                          <span className="text-slate-400 font-semibold">Spouse Subtotal</span>
                          <span className="text-white font-bold">{fmt2(
                            data.spouseSources.reduce((s, src) => {
                              const isSE = src.sourceType !== "employment";
                              return s + (isSE && overMedian
                                ? (parseFloat(src.businessGrossIncome)||0)
                                : isSE
                                  ? Math.max(0, (parseFloat(src.businessGrossIncome)||0) - (parseFloat(src.businessExpenses)||0))
                                  : srcMonthlyGross(src) + srcBonusGross(src));
                            }, 0)
                          )}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {(() => {
                    const otherItems = [
                      {label:"SS Retirement", amount: parseFloat(data.dSsRetirement)||0, isSS:true},
                      {label:"SS Disability (SSDI)", amount: parseFloat(data.dSsDisability)||0, isSS:true},
                      {label:"VA Disability Compensation", amount: parseFloat(data.dVeterans)||0, isSS:true},
                      {label:"Military / Veterans Retirement Pay", amount: parseFloat(data.dVeteransRetirement)||0, isSS:false},
                      {label:"Unemployment", amount: parseFloat(data.dUnemployment)||0, isSS:false},
                      {label:"Workers Comp", amount: parseFloat(data.dWorkersComp)||0, isSS:false},
                      {label:"Pension / Retirement", amount: parseFloat(data.dPension)||0, isSS:false},
                      {label:"Rental Income", amount: parseFloat(data.dRental)||0, isSS:false},
                      {label:"Alimony Received", amount: parseFloat(data.dAlimony)||0, isSS:false},
                      {label:"Child Support Received", amount: parseFloat(data.dChildSupport)||0, isSS:false},
                      {label:"Family Support", amount: parseFloat(data.dFamilySupport)||0, isSS:false},
                      {label:"Royalties", amount: parseFloat(data.dRoyalties)||0, isSS:false},
                      {label:"Investment Income", amount: parseFloat(data.dInvestment)||0, isSS:false},
                      {label:"Other Income", amount: parseFloat(data.dOtherIncome)||0, isSS:false},
                      ...data.dependents.filter(d=>d.contributesFinancially==="yes" && parseFloat(d.monthlyContribution)>0).map(d=>({
                        label:`${d.relationship||"Dependent"} Contribution`, amount: parseFloat(d.monthlyContribution)||0, isSS:false
                      })),
                      ...(hasSpouse ? [
                        {label:`${spouseName} — SS Retirement`, amount: parseFloat(data.sSsRetirement)||0, isSS:true},
                        {label:`${spouseName} — SS Disability`, amount: parseFloat(data.sSsDisability)||0, isSS:true},
                        {label:`${spouseName} — VA Disability`, amount: parseFloat(data.sVeterans)||0, isSS:true},
                        {label:`${spouseName} — Veterans Retirement Pay`, amount: parseFloat(data.sVeteransRetirement)||0, isSS:false},
                        {label:`${spouseName} — Unemployment`, amount: parseFloat(data.sUnemployment)||0, isSS:false},
                        {label:`${spouseName} — Workers Comp`, amount: parseFloat(data.sWorkersComp)||0, isSS:false},
                        {label:`${spouseName} — Pension`, amount: parseFloat(data.sPension)||0, isSS:false},
                        {label:`${spouseName} — Rental`, amount: parseFloat(data.sRental)||0, isSS:false},
                        {label:`${spouseName} — Alimony`, amount: parseFloat(data.sAlimony)||0, isSS:false},
                        {label:`${spouseName} — Child Support`, amount: parseFloat(data.sChildSupport)||0, isSS:false},
                        {label:`${spouseName} — Family Support`, amount: parseFloat(data.sFamilySupport)||0, isSS:false},
                        {label:`${spouseName} — Royalties`, amount: parseFloat(data.sRoyalties)||0, isSS:false},
                        {label:`${spouseName} — Investment`, amount: parseFloat(data.sInvestment)||0, isSS:false},
                        {label:`${spouseName} — Other`, amount: parseFloat(data.sOtherIncome)||0, isSS:false},
                      ] : []),
                    ].filter(i => i.amount > 0);
                    if (otherItems.length === 0) return null;
                    return (
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Other Income</p>
                        <div className="space-y-1 bg-slate-800/30 rounded-xl border border-slate-700/40 p-3">
                          {otherItems.map((item, i) => (
                            <div key={i} className="flex justify-between items-center text-xs">
                              <div className="flex items-center gap-1.5">
                                {item.isSS && <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1 py-0.5 rounded font-bold flex-shrink-0">SS</span>}
                                <span className="text-slate-300">{item.label}</span>
                              </div>
                              <span className="text-white font-semibold">{fmt2(item.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {(() => {
                    const totalGross = dGrossWages+sGrossWages+dBizGross+sBizGross+dGovOther+sGovOther;
                    const nonSSTotal = totalGross - ssExcluded;
                    return (
                      <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-3 space-y-1.5 text-xs">
                        {ssExcluded > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400">Wages &amp; Non-SS Income</span>
                            <span className="text-white font-semibold">{fmt2(nonSSTotal)}</span>
                          </div>
                        )}
                        {ssExcluded > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-blue-400/80">Social Security / VA (excl. from CMI)</span>
                            <span className="text-blue-300 font-semibold">{fmt2(ssExcluded)}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center pt-1 border-t border-slate-700/50 font-bold">
                          <span className="text-slate-200">Total Gross Monthly Income</span>
                          <span className="text-white">{fmt2(totalGross)}</span>
                        </div>
                      </div>
                    );
                  })()}

                </div>
              </div>
            </SectionCard>
            <ErrorBanner errors={errors}/>
          </div>
        );
      }

      case 3: return (
        <div>
          <div className="mb-4 p-4 bg-slate-800/60 border border-slate-600 rounded-xl space-y-3">
            <div>
              <p className="text-xs font-semibold text-slate-300 mb-1">Equity and why it matters</p>
              <p className="text-xs text-slate-400 leading-relaxed">Equity is the difference between what your property is worth and what you owe on it. For example, if your home is worth $300,000 and you owe $250,000, your equity is $50,000. In bankruptcy, equity is important because it determines whether the property can be protected.</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-300 mb-1">What is an exemption?</p>
              <p className="text-xs text-slate-400 leading-relaxed">An exemption is a legal protection that allows you to keep certain property in bankruptcy up to a specified dollar amount. Federal and state laws provide exemptions for your home (the "homestead exemption"), vehicles, household goods, retirement accounts, and more. If your equity in a property is within the exemption limit, you may be able to keep it. Your attorney will determine which exemptions apply to your situation.</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-300 mb-1">What is a trustee?</p>
              <p className="text-xs text-slate-400 leading-relaxed">A bankruptcy trustee is a court-appointed official who reviews your case to ensure your disclosures are accurate and complete. In a Chapter 7 case, the trustee may liquidate (sell) non-exempt assets to pay creditors. In a Chapter 13 case, the trustee administers your repayment plan. Accurate and honest disclosures are essential.</p>
            </div>
          </div>
          <SectionCard title="Real Estate — Schedule A/B" icon="🏡">
            <Field label="Do you own or have any interest in real estate?" error={e("ownsRealEstate")}>
              <RadioGroup name="ownRE" current={data.ownsRealEstate} onChange={v=>u("ownsRealEstate",v)} error={e("ownsRealEstate")}
                options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
            </Field>
            {data.ownsRealEstate==="yes" && <>
              <Field label="Property Type" error={e("realPropType")}>
                <Select value={data.realPropType} onChange={v=>{u("realPropType",v); if(v!=="Mobile Home"){u("payLotSpaceRent",""); u("expLotSpaceRent","");}}} hasError={!!e("realPropType")}
                  options={["Primary Residence","Mobile Home","Investment Property","Rental Property","Vacant Land","Commercial","Other"]}/>
              </Field>
              <Field label="Property Address" error={e("realPropAddress")}>
                <Input value={data.realPropAddress} onChange={v=>u("realPropAddress",v)} placeholder="Street, City, State ZIP" hasError={!!e("realPropAddress")}/>
              </Field>
              <Field label="Do you currently live in this property as your primary residence?" error={e("isOccupiedPrimary")}>
                <RadioGroup name="isPrimary" current={data.isOccupiedPrimary} onChange={v=>{
                  u("isOccupiedPrimary",v);
                  if (v==="yes" && data.realPropMonthlyPayment) u("expRentMortgage",data.realPropMonthlyPayment);
                  if (v==="no") { u("expRentMortgage",""); }
                }} error={e("isOccupiedPrimary")}
                  options={[{value:"yes",label:"Yes — I live here as my primary residence"},{value:"no",label:"No — I do not currently live in this property"}]}/>
              </Field>
              {data.isOccupiedPrimary==="no" && (
                <>
                  <Field label="Do you pay rent where you currently live?" error={e("payRentAtResidence")}>
                    <RadioGroup name="payRentAtRes" current={data.payRentAtResidence} onChange={v=>{
                      u("payRentAtResidence",v);
                      if (v==="no") { u("rentAtResidence",""); u("expRentMortgage","0"); }
                    }} error={e("payRentAtResidence")}
                      options={[{value:"yes",label:"Yes — I pay rent at my current residence"},{value:"no",label:"No — I do not pay rent where I live"}]}/>
                  </Field>
                  {data.payRentAtResidence==="yes" && (
                    <Field label="Monthly Rent Amount" error={e("rentAtResidence")}>
                      <Input type="number" value={data.rentAtResidence} onChange={v=>{
                        u("rentAtResidence",v);
                        u("expRentMortgage",v);
                      }} placeholder="Enter monthly rent" hasError={!!e("rentAtResidence")}/>
                    </Field>
                  )}
                </>
              )}
              {(() => {
                const zl = data.zillowLookup;
                const canLookup = !!(data.realPropAddress && data.realPropAddress.trim());
                const isLoading = zl.status === "loading";
                const isDone = zl.status === "done";
                const isErr = zl.status === "error";

                const doZillowLookup = async () => {
                  u("zillowLookup", { ...zl, status: "loading", error: null });
                  try {
                    const r = await fetch(`${SUPABASE_URL}/functions/v1/property-value`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
                      body: JSON.stringify({ address: data.realPropAddress }),
                    });
                    const d = await r.json();
                    if (d.error) throw new Error(d.error);
                    u("zillowLookup", { status: "done", zestimate: d.zestimate, low: d.low, high: d.high, found: d.found, sourceUrl: d.sourceUrl, error: null, override: false, overrideReason: "", overrideDetails: "" });
                    if (d.zestimate) { u("realPropValue", String(d.zestimate)); u("realPropValueDate", new Date().toISOString()); u("realPropValueConfirmed", false); }
                  } catch (err) {
                    u("zillowLookup", { ...zl, status: "error", error: String(err) });
                  }
                };

                const isStale = (() => {
                  const d = data.realPropValueDate;
                  if (!d) return false;
                  return (Date.now() - new Date(d).getTime()) > 90 * 24 * 60 * 60 * 1000;
                })();

                return (
                  <>
                    <div className="mb-4 bg-slate-800/60 border border-slate-600 rounded-xl px-4 py-3">
                      <p className="text-xs text-amber-300 mb-3">
                        <span className="font-semibold">Trustee notice:</span> Trustees typically use Zillow's Zestimate or a comparable market analysis to verify property values. Click below to fetch the Zestimate — it will auto-populate the value field.
                      </p>
                      <button
                        onClick={doZillowLookup}
                        disabled={!canLookup || isLoading}
                        className={`inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg border transition-all ${canLookup && !isLoading ? "bg-amber-400/10 border-amber-400/50 text-amber-400 hover:bg-amber-400/20 hover:border-amber-400" : "border-slate-600 text-slate-500 cursor-not-allowed"}`}
                      >
                        {isLoading ? (
                          <><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Looking up Zestimate…</>
                        ) : (
                          <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/></svg>Verify My Value with Zillow</>
                        )}
                      </button>
                      {!canLookup && !isLoading && <p className="text-xs text-slate-500 mt-2">Enter your property address above to enable lookup.</p>}
                      {isErr && <p className="text-xs text-red-400 mt-2">Could not retrieve Zestimate automatically. Please enter the value manually below.</p>}
                      {isDone && (
                        <div className="mt-3 bg-green-400/5 border border-green-400/20 rounded-lg px-3 py-2.5">
                          {zl.zestimate ? (
                            <>
                              <p className="text-xs font-semibold text-green-400 mb-1">Zillow Zestimate retrieved</p>
                              <div className="flex items-end gap-4">
                                <div>
                                  <p className="text-xs text-slate-400">Zestimate</p>
                                  <p className="text-lg font-bold text-white">${(zl.zestimate||0).toLocaleString()}</p>
                                </div>
                                {zl.low && zl.high && (
                                  <div>
                                    <p className="text-xs text-slate-400">Range</p>
                                    <p className="text-sm text-slate-300">${zl.low.toLocaleString()} – ${zl.high.toLocaleString()}</p>
                                  </div>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 mt-1.5">Value auto-populated below. If you believe your property is worth less, use the override option.</p>
                            </>
                          ) : (
                            <p className="text-xs text-amber-300">No Zestimate found for this address. Please enter the value manually or <a href={zl.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">search Zillow directly</a>.</p>
                          )}
                        </div>
                      )}
                    </div>

                    <Field label="Estimated Market Value" error={e("realPropValue")}>
                      <Input type="number" value={data.realPropValue} onChange={v=>{ u("realPropValue",v); u("realPropValueDate", new Date().toISOString()); u("realPropValueConfirmed",false); }} placeholder="Enter amount" hasError={!!e("realPropValue")}/>
                    </Field>

                    {data.realPropValueDate && (
                      <p className="text-xs text-slate-500 -mt-3 mb-3">
                        Value last verified: <span className="text-slate-400">{new Date(data.realPropValueDate).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span>
                      </p>
                    )}

                    {isStale && (
                      <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/40 rounded-xl flex gap-3 items-start">
                        <svg className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-amber-300 mb-1">Value is more than 90 days old — please update</p>
                          <p className="text-xs text-amber-200/70 mb-2">Your property value was last verified over 90 days ago. Please click "Verify My Value with Zillow" above to get a current estimate, or visit <a href="https://www.zillow.com" target="_blank" rel="noopener noreferrer" className="underline text-amber-300">zillow.com</a> and update the value manually.</p>
                          <a href="https://www.zillow.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                            Check current value on Zillow
                          </a>
                        </div>
                      </div>
                    )}

                    {data.realPropValue && !isStale && (
                      <label className="flex items-start gap-3 mb-4 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={!!data.realPropValueConfirmed}
                          onChange={e=>u("realPropValueConfirmed", e.target.checked)}
                          className="mt-0.5 w-4 h-4 rounded border-slate-500 bg-slate-800 text-amber-400 focus:ring-amber-400/30 flex-shrink-0"
                        />
                        <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors leading-relaxed">
                          I confirm this value is accurate and current as of today. I understand that an inaccurate value may affect my bankruptcy case.
                        </span>
                      </label>
                    )}

                    {isDone && zl.zestimate && !zl.override && (
                      <div className="mb-4 -mt-2">
                        <button
                          onClick={()=>u("zillowLookup",{...zl,override:true})}
                          className="text-xs text-slate-400 hover:text-amber-400 underline underline-offset-2 transition-colors"
                        >
                          I believe my property is worth less than this estimate
                        </button>
                      </div>
                    )}

                    {zl.override && (
                      <div className="mb-4 bg-blue-500/5 border border-blue-500/20 rounded-xl px-4 py-3">
                        <p className="text-xs font-semibold text-blue-300 mb-3">Why do you believe your property is worth less?</p>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          {["Deferred maintenance","Structural issues","Outdated systems","Neighborhood decline","Recent comparable sales","Other"].map(reason => (
                            <button
                              key={reason}
                              onClick={()=>u("zillowLookup",{...zl,overrideReason:zl.overrideReason===reason?"":reason})}
                              className={`text-xs px-3 py-2 rounded-lg border text-left transition-all ${zl.overrideReason===reason?"bg-blue-500/20 border-blue-400 text-blue-300":"bg-slate-800 border-slate-600 text-slate-400 hover:border-blue-400/40"}`}
                            >
                              {reason}
                            </button>
                          ))}
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Additional Details <span className="normal-case font-normal text-slate-500">(optional)</span></label>
                          <textarea
                            value={zl.overrideDetails||""}
                            onChange={e=>u("zillowLookup",{...zl,overrideDetails:e.target.value})}
                            placeholder="Describe any condition issues, needed repairs, or recent sales in your area that support a lower value…"
                            rows={3}
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-400 resize-none"
                          />
                        </div>
                        <button
                          onClick={()=>u("zillowLookup",{...zl,override:false,overrideReason:"",overrideDetails:""})}
                          className="text-xs text-slate-500 hover:text-slate-300 mt-2 underline underline-offset-2 transition-colors"
                        >
                          Cancel override
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
              <Field label="What do you intend to do with this property?" error={e("realPropIntent")}>
                <RadioGroup name="realPropIntent" current={data.realPropIntent} onChange={v=>u("realPropIntent",v)} error={e("realPropIntent")}
                  options={[{value:"keep",label:"Keep — I want to keep this property and continue paying the mortgage"},{value:"surrender",label:"Surrender — I wish to give this property back to the lender"}]}/>
              </Field>
              {data.realPropIntent==="surrender" && (
                <div className="mt-1 mb-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300">
                  This property will be surrendered. The mortgage will not be factored into your plan funding requirements.
                </div>
              )}
              <Field label="Mortgage Lender" error={e("mortgageLender")}>
                <Input value={data.mortgageLender||""} onChange={v=>u("mortgageLender",v)} placeholder="e.g. Chase, Wells Fargo, Rocket Mortgage" hasError={!!e("mortgageLender")}/>
              </Field>
              <Field label="Total Mortgage Balance" error={e("mortgageBalance")}>
                <Input type="number" value={data.mortgageBalance} onChange={v=>{
                  u("mortgageBalance",v);
                  if (data.hasMortgage==="yes" || !data.securedDebt) { u("securedDebt",v); u("hasMortgage","yes"); }
                }} placeholder="Enter amount" hasError={!!e("mortgageBalance")}/>
              </Field>
              <Field label="Monthly Mortgage Payment" hint="Auto-populates your expense schedule" error={e("realPropMonthlyPayment")}>
                <Input type="number" value={data.realPropMonthlyPayment} onChange={v=>{
                  u("realPropMonthlyPayment",v);
                  if (data.isOccupiedPrimary==="yes") u("expRentMortgage",v);
                }} placeholder="Enter monthly payment" hasError={!!e("realPropMonthlyPayment")}/>
              </Field>
              {data.realPropType==="Mobile Home" && (
                <>
                  <Field label="Do you pay lot or space rent for the land your mobile home sits on?" error={e("payLotSpaceRent")}>
                    <RadioGroup name="payLotSpaceRent" current={data.payLotSpaceRent} onChange={v=>{
                      u("payLotSpaceRent",v);
                      if (v==="no") u("expLotSpaceRent","0");
                    }} error={e("payLotSpaceRent")}
                      options={[{value:"yes",label:"Yes — I pay lot / space rent"},{value:"no",label:"No — I own the land"}]}/>
                  </Field>
                  {data.payLotSpaceRent==="yes" && (
                    <Field label="Monthly Lot / Space Rent" error={e("expLotSpaceRent")}>
                      <Input type="number" value={data.expLotSpaceRent} onChange={v=>u("expLotSpaceRent",v)} placeholder="Enter monthly amount" hasError={!!e("expLotSpaceRent")}/>
                    </Field>
                  )}
                </>
              )}
              {data.realPropValue&&data.mortgageBalance && (
                <div className="p-3 rounded-lg mt-1 mb-3 bg-slate-800/60 border border-slate-600">
                  <p className="text-xs text-slate-400 mb-1">Estimated Equity (value minus mortgage balance):</p>
                  <p className="text-lg font-serif font-bold text-white">${realEquity().toLocaleString()}</p>
                  <p className="text-xs text-slate-500 mt-1">Your attorney will determine whether this equity can be protected by an exemption.</p>
                </div>
              )}
              <Field label="When did you acquire this property?">
                <Input type="date" value={data.homeAcquiredDate} onChange={v=>u("homeAcquiredDate",v)}/>
              </Field>

              {/* Real Property Ownership */}
              <div className="mt-4 pt-4 border-t border-slate-700/60">
                <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Ownership of This Property</h4>
                <Field label={data.filingType==="joint"||data.filingType==="individual-nonfiling-spouse" ? "Who owns this property?" : "Is this property 100% owned by you?"} error={e("realPropOwnershipType")}>
                  <RadioGroup
                    name="realPropOwnershipType"
                    current={data.realPropOwnershipType}
                    onChange={v=>{u("realPropOwnershipType",v); if(v!=="debtor1"&&v!=="spouse"){u("realPropOwnedBeforeMarriage","");u("realPropMaritalFundsUsed","");u("realPropHasPrenup","");u("realPropInheritedOrGift","");u("realPropCommunityPropFlag",false);}}}
                    error={e("realPropOwnershipType")}
                    options={
                      data.filingType==="joint"
                        ? [{value:"debtor1",label:"Debtor 1 only"},{value:"debtor2",label:"Debtor 2 only"},{value:"both",label:"Owned jointly by both debtors"}]
                        : data.filingType==="individual-nonfiling-spouse"
                        ? [{value:"debtor1",label:"Debtor only (100%)"},{value:"spouse",label:"Non-filing spouse only (100%)"},{value:"both",label:"Owned jointly with non-filing spouse"}]
                        : [{value:"debtor1",label:"Yes — 100% owned by me"},{value:"partial",label:"No — shared ownership with another person"}]
                    }
                  />
                </Field>

                {(data.filingType==="joint"||data.filingType==="individual-nonfiling-spouse") && (data.realPropOwnershipType==="debtor1"||data.realPropOwnershipType==="spouse") && (
                  <>
                    <Field label="Was this property owned before the marriage?" error={e("realPropOwnedBeforeMarriage")}>
                      <RadioGroup
                        name="realPropOwnedBeforeMarriage"
                        current={data.realPropOwnedBeforeMarriage}
                        onChange={v=>{u("realPropOwnedBeforeMarriage",v); if(v==="no"){u("realPropMaritalFundsUsed","");u("realPropHasPrenup","");u("realPropInheritedOrGift","");u("realPropCommunityPropFlag",false);}}}
                        error={e("realPropOwnedBeforeMarriage")}
                        options={[{value:"yes",label:"Yes — owned before marriage"},{value:"no",label:"No — acquired during marriage"},{value:"unknown",label:"Unsure"}]}
                      />
                    </Field>

                    {data.realPropOwnedBeforeMarriage==="yes" && (
                      <>
                        <Field label="Was this property inherited or received as a gift solely by one spouse?" error={e("realPropInheritedOrGift")}>
                          <RadioGroup
                            name="realPropInheritedOrGift"
                            current={data.realPropInheritedOrGift}
                            onChange={v=>u("realPropInheritedOrGift",v)}
                            error={e("realPropInheritedOrGift")}
                            options={[{value:"yes",label:"Yes — inherited or received as a gift to one spouse alone"},{value:"no",label:"No — purchased with separate property funds"},{value:"unsure",label:"Unsure"}]}
                          />
                        </Field>
                        <Field label="Were any marital (community) funds ever used to pay for, improve, or maintain this property (e.g., mortgage payments, renovations, repairs made after marriage)?" error={e("realPropMaritalFundsUsed")}>
                          <RadioGroup
                            name="realPropMaritalFundsUsed"
                            current={data.realPropMaritalFundsUsed}
                            onChange={v=>u("realPropMaritalFundsUsed",v)}
                            error={e("realPropMaritalFundsUsed")}
                            options={[{value:"yes",label:"Yes — marital funds were used"},{value:"no",label:"No — only separate property funds were used"},{value:"unsure",label:"Unsure / some of both"}]}
                          />
                        </Field>
                        {(data.realPropMaritalFundsUsed==="yes"||data.realPropMaritalFundsUsed==="unsure") && (
                          <>
                            <Field label="Is there a prenuptial (or postnuptial) agreement that designates this property as separate property?" error={e("realPropHasPrenup")}>
                              <RadioGroup
                                name="realPropHasPrenup"
                                current={data.realPropHasPrenup}
                                onChange={v=>{u("realPropHasPrenup",v); u("realPropCommunityPropFlag",v==="no"||v==="unsure");}}
                                error={e("realPropHasPrenup")}
                                options={[{value:"yes",label:"Yes — there is a prenup or postnup protecting this as separate property"},{value:"no",label:"No agreement exists"},{value:"unsure",label:"Unsure"}]}
                              />
                            </Field>
                            {(data.realPropHasPrenup==="no"||data.realPropHasPrenup==="unsure") && (
                              <div className="mt-1 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 flex gap-2">
                                <span className="text-red-400 flex-shrink-0">⚑</span>
                                <span><strong>Attorney Review Required:</strong> Although this property was owned before marriage, the use of marital (community) funds without a protecting prenuptial agreement could mean it has been <em>transmuted</em> to community property in whole or in part. Your attorney must evaluate this before filing to determine accurate ownership and exemption eligibility.</span>
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>

              {homesteadDaysOwned() !== null && (
                <div className="p-3 rounded-xl mb-3 text-xs border bg-slate-800/60 border-slate-600 text-slate-400">
                  Property owned approximately <strong className="text-white">{homesteadDaysOwned()?.toLocaleString()} days</strong> ({Math.round((homesteadDaysOwned()||0)/30)} months). Your attorney will review whether the § 522(p) homestead cap under federal law applies to this property based on when it was acquired.
                </div>
              )}
              <div className="mt-4 mb-2">
                <h4 className="font-serif text-sm font-semibold text-white mb-3">Homeowners Association (HOA)</h4>
                <Field label="Is this property subject to an HOA?" error={e("hasHoa")}>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={()=>{u("hasHoa","yes");}} className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${data.hasHoa==="yes"?"bg-amber-400 text-slate-900 border-amber-400":"bg-slate-800 text-slate-300 border-slate-600 hover:border-amber-400/50"}`}>Yes — I have an HOA</button>
                    <button onClick={()=>{u("hasHoa","no");u("hoaName","");u("hoaMonthlyDues","");u("hoaIsCurrent","");u("hoaPastDueAmount","");}} className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${data.hasHoa==="no"?"bg-slate-500 text-white border-slate-500":"bg-slate-800 text-slate-300 border-slate-600 hover:border-slate-400"}`}>I don't have an HOA</button>
                  </div>
                  {e("hasHoa") && <p className="text-xs text-red-400 mt-1">{e("hasHoa")}</p>}
                </Field>
                {data.hasHoa==="yes" && (
                  <div className="bg-slate-900/60 border border-slate-600 rounded-xl p-4 mb-3 mt-2">
                    <Field label="HOA Name / Management Company" error={e("hoaName")}>
                      <Input value={data.hoaName} onChange={v=>u("hoaName",v)} placeholder="e.g. Sunrise Community HOA" hasError={!!e("hoaName")}/>
                    </Field>
                    <Field label="Monthly HOA Dues" hint="Auto-populates your expense schedule" error={e("hoaMonthlyDues")}>
                      <Input type="number" value={data.hoaMonthlyDues} onChange={v=>{u("hoaMonthlyDues",v);u("expHoa",v);}} placeholder="Enter monthly amount" hasError={!!e("hoaMonthlyDues")}/>
                    </Field>
                    <Field label="Are you current on your HOA dues?" error={e("hoaIsCurrent")}>
                      <RadioGroup name="hoaIsCurrent" current={data.hoaIsCurrent}
                        onChange={v=>{u("hoaIsCurrent",v);if(v==="yes")u("hoaPastDueAmount","");}}
                        error={e("hoaIsCurrent")}
                        options={[{value:"yes",label:"Yes — current"},{value:"no",label:"No — behind on payments"}]}/>
                    </Field>
                    {data.hoaIsCurrent==="no" && (
                      <Field label="Total HOA Past Due Amount" error={e("hoaPastDueAmount")}>
                        <Input type="number" value={data.hoaPastDueAmount} onChange={v=>u("hoaPastDueAmount",v)} placeholder="Enter total amount past due" hasError={!!e("hoaPastDueAmount")}/>
                      </Field>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-4 mb-2">
                <h4 className="font-serif text-sm font-semibold text-white mb-3">Additional Liens on This Property</h4>
                <Field label="Are there any additional liens or encumbrances on this property?" error={e("hasLiens")}>
                  <RadioGroup name="hasLiens" current={data.hasLiens}
                    onChange={v=>{ u("hasLiens",v); if(v==="no") u("liens",[]); if(v==="yes" && (!data.liens||data.liens.length===0)) u("liens",[emptyLien(Date.now())]); }}
                    error={e("hasLiens")}
                    options={[{value:"yes",label:"Yes — there are additional liens"},{value:"no",label:"No — the first mortgage is the only lien"}]}/>
                </Field>
                {data.hasLiens==="yes" && (
                  <div>
                    {(data.liens||[]).map((lien,i)=>(
                      <div key={lien.id} className="bg-slate-900/60 border border-slate-600 rounded-xl p-4 mb-3">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Lien {i+1}</p>
                          {data.liens.length>1 && (
                            <button onClick={()=>u("liens",data.liens.filter((_,idx)=>idx!==i))}
                              className="text-xs text-red-400 hover:text-red-300 border border-red-400/30 px-2 py-1 rounded-lg transition-colors">Remove</button>
                          )}
                        </div>
                        <Field label="Lien Type" error={errors[`lien_${i}_lienType`]}>
                          <Select value={lien.lienType}
                            onChange={v=>u("liens",data.liens.map((l,idx)=>idx===i?{...l,lienType:v}:l))}
                            hasError={!!errors[`lien_${i}_lienType`]}
                            options={["HELOC","Second Mortgage / Home Equity Loan","IRS Tax Lien","State / Local Tax Lien","Judgment Lien","Mechanic's Lien","Other"]}
                            placeholder="Select lien type..."/>
                        </Field>
                        <Field label="Lien Holder" error={errors[`lien_${i}_lienHolder`]}>
                          <Input value={lien.lienHolder} onChange={v=>u("liens",data.liens.map((l,idx)=>idx===i?{...l,lienHolder:v}:l))} placeholder="e.g. Chase Bank, IRS" hasError={!!errors[`lien_${i}_lienHolder`]}/>
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Outstanding Balance" error={errors[`lien_${i}_balance`]}>
                            <Input type="number" value={lien.balance} onChange={v=>u("liens",data.liens.map((l,idx)=>idx===i?{...l,balance:v}:l))} placeholder="Enter balance" hasError={!!errors[`lien_${i}_balance`]}/>
                          </Field>
                          <Field label="Monthly Payment">
                            <Input type="number" value={lien.monthlyPayment} onChange={v=>u("liens",data.liens.map((l,idx)=>idx===i?{...l,monthlyPayment:v}:l))} placeholder="Enter payment"/>
                          </Field>
                        </div>
                        <Field label="Are you current on this lien?" error={errors[`lien_${i}_isCurrent`]}>
                          <RadioGroup name={`lienCurr_${i}`} current={lien.isCurrent}
                            onChange={v=>u("liens",data.liens.map((l,idx)=>idx===i?{...l,isCurrent:v,pastDueAmount:v==="yes"?"":l.pastDueAmount}:l))}
                            error={errors[`lien_${i}_isCurrent`]}
                            options={[{value:"yes",label:"Yes — current"},{value:"no",label:"No — behind on payments"}]}/>
                        </Field>
                        {lien.isCurrent==="no" && (
                          <Field label="Past Due Amount" error={errors[`lien_${i}_pastDueAmount`]}>
                            <Input type="number" value={lien.pastDueAmount}
                              onChange={v=>u("liens",data.liens.map((l,idx)=>idx===i?{...l,pastDueAmount:v}:l))}
                              placeholder="Enter total amount past due" hasError={!!errors[`lien_${i}_pastDueAmount`]}/>
                          </Field>
                        )}
                      </div>
                    ))}
                    <button onClick={()=>u("liens",[...(data.liens||[]),emptyLien(Date.now())])}
                      className="w-full border border-dashed border-amber-400/40 hover:border-amber-400 text-amber-400 text-sm font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 mb-2">
                      <span className="text-lg">+</span> Add Another Lien
                    </button>
                    {totalLienPayments()>0 && (
                      <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs text-blue-300">
                        📋 Total lien payments: <strong>${totalLienPayments().toLocaleString()}/mo</strong> — balance: <strong>${totalLienBalances().toLocaleString()}</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <Field label="Do you own a second property?" error={e("secondProperty")}>
                <RadioGroup name="sec2" current={data.secondProperty} onChange={v=>u("secondProperty",v)} error={e("secondProperty")}
                  options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
              </Field>
              {data.secondProperty==="yes" && <>
                <Field label="Second Property Address" error={e("secondPropAddress")}>
                  <Input value={data.secondPropAddress} onChange={v=>u("secondPropAddress",v)} placeholder="Street, City, State ZIP" hasError={!!e("secondPropAddress")}/>
                </Field>
                <Field label="Estimated Value" error={e("secondPropValue")}><Input type="number" value={data.secondPropValue} onChange={v=>u("secondPropValue",v)} placeholder="Enter amount" hasError={!!e("secondPropValue")}/></Field>
                <Field label="Mortgage Balance" error={e("secondMortgage")}><Input type="number" value={data.secondMortgage} onChange={v=>u("secondMortgage",v)} placeholder="Enter amount" hasError={!!e("secondMortgage")}/></Field>
                <Field label="Monthly Mortgage Payment" hint="Auto-populates your expense schedule" error={e("secondMortgagePayment")}>
                  <Input type="number" value={data.secondMortgagePayment} onChange={v=>u("secondMortgagePayment",v)} placeholder="Enter monthly payment" hasError={!!e("secondMortgagePayment")}/>
                </Field>

                {/* Second Property Ownership */}
                <div className="mt-3 pt-3 border-t border-slate-700/60">
                  <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Ownership of Second Property</h4>
                  <Field label={data.filingType==="joint"||data.filingType==="individual-nonfiling-spouse" ? "Who owns this property?" : "Is this property 100% owned by you?"}>
                    <RadioGroup
                      name="secondPropOwnershipType"
                      current={data.secondPropOwnershipType}
                      onChange={v=>{u("secondPropOwnershipType",v); if(v!=="debtor1"&&v!=="spouse"){u("secondPropOwnedBeforeMarriage","");u("secondPropMaritalFundsUsed","");u("secondPropHasPrenup","");u("secondPropInheritedOrGift","");u("secondPropCommunityPropFlag",false);}}}
                      options={
                        data.filingType==="joint"
                          ? [{value:"debtor1",label:"Debtor 1 only"},{value:"debtor2",label:"Debtor 2 only"},{value:"both",label:"Jointly by both debtors"}]
                          : data.filingType==="individual-nonfiling-spouse"
                          ? [{value:"debtor1",label:"Debtor only"},{value:"spouse",label:"Non-filing spouse only"},{value:"both",label:"Joint with non-filing spouse"}]
                          : [{value:"debtor1",label:"100% mine"},{value:"partial",label:"Shared with another person"}]
                      }
                    />
                  </Field>
                  {(data.filingType==="joint"||data.filingType==="individual-nonfiling-spouse") && (data.secondPropOwnershipType==="debtor1"||data.secondPropOwnershipType==="spouse") && (
                    <>
                      <Field label="Was this property owned before the marriage?">
                        <RadioGroup
                          name="secondPropOwnedBeforeMarriage"
                          current={data.secondPropOwnedBeforeMarriage}
                          onChange={v=>{u("secondPropOwnedBeforeMarriage",v); if(v==="no"){u("secondPropMaritalFundsUsed","");u("secondPropHasPrenup","");u("secondPropCommunityPropFlag",false);}}}
                          options={[{value:"yes",label:"Yes — owned before marriage"},{value:"no",label:"No — acquired during marriage"},{value:"unknown",label:"Unsure"}]}
                        />
                      </Field>
                      {data.secondPropOwnedBeforeMarriage==="yes" && (
                        <>
                          <Field label="Was this property inherited or received as a gift?">
                            <RadioGroup
                              name="secondPropInheritedOrGift"
                              current={data.secondPropInheritedOrGift}
                              onChange={v=>u("secondPropInheritedOrGift",v)}
                              options={[{value:"yes",label:"Yes — inherited or gifted to one spouse alone"},{value:"no",label:"No"},{value:"unsure",label:"Unsure"}]}
                            />
                          </Field>
                          <Field label="Were any marital funds used to pay for, improve, or maintain this property?">
                            <RadioGroup
                              name="secondPropMaritalFundsUsed"
                              current={data.secondPropMaritalFundsUsed}
                              onChange={v=>u("secondPropMaritalFundsUsed",v)}
                              options={[{value:"yes",label:"Yes"},{value:"no",label:"No"},{value:"unsure",label:"Unsure"}]}
                            />
                          </Field>
                          {(data.secondPropMaritalFundsUsed==="yes"||data.secondPropMaritalFundsUsed==="unsure") && (
                            <>
                              <Field label="Is there a prenuptial or postnuptial agreement protecting this as separate property?">
                                <RadioGroup
                                  name="secondPropHasPrenup"
                                  current={data.secondPropHasPrenup}
                                  onChange={v=>{u("secondPropHasPrenup",v); u("secondPropCommunityPropFlag",v==="no"||v==="unsure");}}
                                  options={[{value:"yes",label:"Yes — agreement exists"},{value:"no",label:"No"},{value:"unsure",label:"Unsure"}]}
                                />
                              </Field>
                              {(data.secondPropHasPrenup==="no"||data.secondPropHasPrenup==="unsure") && (
                                <div className="mt-1 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 flex gap-2">
                                  <span className="text-red-400 flex-shrink-0">⚑</span>
                                  <span><strong>Attorney Review Required:</strong> Possible transmutation to community property. Your attorney will need to evaluate this second property before filing.</span>
                                </div>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              </>}
              <Field label="Do you own any investment or rental properties?" error={e("hasInvestmentProperty")}>
                <RadioGroup name="hasInvestmentProperty" current={data.hasInvestmentProperty} onChange={v=>u("hasInvestmentProperty",v)} error={e("hasInvestmentProperty")}
                  options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
              </Field>
              <Field label="Do you own any raw land, timeshares, co-ops, or other real estate?" error={e("hasRawLandTimeshare")}>
                <RadioGroup name="hasRawLandTimeshare" current={data.hasRawLandTimeshare} onChange={v=>u("hasRawLandTimeshare",v)} error={e("hasRawLandTimeshare")}
                  options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
              </Field>
              <Field label="Is your name on anyone else's real estate?" error={e("hasNameOnOthersRealEstate")}>
                <RadioGroup name="hasNameOnOthersRealEstate" current={data.hasNameOnOthersRealEstate} onChange={v=>u("hasNameOnOthersRealEstate",v)} error={e("hasNameOnOthersRealEstate")}
                  options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
              </Field>
            </>}
          </SectionCard>

          {/* Non-Filing Spouse Assets — shown for individual-nonfiling-spouse */}
          {data.filingType==="individual-nonfiling-spouse" && (
            <SectionCard title="Non-Filing Spouse Assets — Required Disclosure" icon="👥">
              <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs text-blue-300 leading-relaxed">
                <strong>Important:</strong> In community property states, assets and debts acquired during the marriage are generally owned equally by both spouses — even if only one spouse is filing bankruptcy. The trustee and court require disclosure of your non-filing spouse's assets and income regardless of whether they are filing. Failure to disclose these assets is a federal crime.
              </div>

              <Field label="Does your non-filing spouse own any real estate, vehicles, bank accounts, retirement accounts, or other significant assets acquired during the marriage?" error={e("nfsAssets")}>
                <RadioGroup
                  name="nfsAssets"
                  current={data.nfsAssets}
                  onChange={v=>{u("nfsAssets",v); if(v==="no")u("nfsAssetDetails","");}}
                  error={e("nfsAssets")}
                  options={[
                    {value:"yes",label:"Yes — my spouse has assets that should be disclosed"},
                    {value:"no",label:"No — my spouse has no significant separate assets"},
                    {value:"unsure",label:"Unsure — I need to verify with my attorney"},
                  ]}
                />
              </Field>

              {(data.nfsAssets==="yes"||data.nfsAssets==="unsure") && (
                <Field label="Please describe your non-filing spouse's assets (real estate, vehicles, accounts, etc.)" hint="Include approximate values where known. Your attorney will review these for community property and exemption analysis." error={e("nfsAssetDetails")}>
                  <textarea
                    value={data.nfsAssetDetails}
                    onChange={e=>u("nfsAssetDetails",e.target.value)}
                    placeholder="e.g. — Toyota Camry 2018 (in spouse's name, ~$15,000) / Savings account at Chase ($8,200) / 401(k) at current employer (~$30,000)…"
                    rows={4}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-400 resize-none"
                  />
                </Field>
              )}

              {data.nfsAssets==="unsure" && (
                <div className="mt-1 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex gap-2">
                  <span className="text-amber-400 flex-shrink-0">⚑</span>
                  <span><strong>Attorney Review Required:</strong> Please discuss your non-filing spouse's assets with your attorney before proceeding. Community property rules vary by state and the analysis can significantly affect your case.</span>
                </div>
              )}
            </SectionCard>
          )}

          <ErrorBanner errors={errors}/>
        </div>
      );

      case 4: return (
        <div>
          <div className="mb-4 p-4 bg-slate-800/60 border border-slate-600 rounded-xl space-y-3">
            <div>
              <p className="text-xs font-semibold text-slate-300 mb-1">Why all assets must be listed</p>
              <p className="text-xs text-slate-400 leading-relaxed">Federal law requires that all assets be disclosed in your bankruptcy schedules, regardless of their value or whether you believe they are protected. Omitting an asset — even unintentionally — can create problems with your case. Your attorney and the bankruptcy trustee will review what you own to determine whether any assets are subject to exemptions or other protections.</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-300 mb-1">Equity and exemptions for personal property</p>
              <p className="text-xs text-slate-400 leading-relaxed">Just as with real estate, the equity in your vehicles and other assets matters. An exemption may allow you to keep property up to a certain dollar value. Common exemptions include those for motor vehicles, household goods, jewelry, tools of trade, and retirement accounts. Your attorney will determine which exemptions apply based on your state's laws.</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-300 mb-1">The role of the bankruptcy trustee</p>
              <p className="text-xs text-slate-400 leading-relaxed">The bankruptcy trustee is a court-appointed official responsible for reviewing your schedules and administering your case. The trustee may ask questions about your assets at the 341 Meeting of Creditors. Providing accurate, complete information now helps ensure that process goes smoothly.</p>
            </div>
          </div>
          <SectionCard title="Vehicles & Titled Property — Schedule A/B" icon="🚗">
            <Field label="Do you own any vehicles or titled assets?" error={e("hasVehicles")}>
              <RadioGroup name="hasVehicles" current={data.hasVehicles} onChange={v=>{u("hasVehicles",v); u("noVehicles",v==="no");}} error={e("hasVehicles")}
                options={[{value:"yes",label:"Yes — I own vehicles or titled assets"},{value:"no",label:"No — I do not own any vehicles"}]}/>
            </Field>
            {data.hasVehicles==="yes" && <>
              {data.vehicles.map((veh,i)=>(
                <div key={veh.id} className="bg-slate-900/60 border border-slate-600 rounded-xl p-4 mb-3">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Vehicle / Asset {i+1}</p>
                    {data.vehicles.length>1 && (
                      <button onClick={()=>remVehicle(i)} className="text-xs text-red-400 hover:text-red-300 border border-red-400/30 px-2 py-1 rounded-lg transition-colors">Remove</button>
                    )}
                  </div>
                  <Field label="Type" error={errors[`veh_${i}_type`]}>
                    <Select value={veh.type} onChange={v=>uVehicle(i,"type",v)} hasError={!!errors[`veh_${i}_type`]} options={VEHICLE_TYPES} placeholder="Select vehicle type..."/>
                  </Field>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Year" error={errors[`veh_${i}_year`]}><Input value={veh.year} onChange={v=>uVehicle(i,"year",v)} placeholder="e.g. 2019" hasError={!!errors[`veh_${i}_year`]}/></Field>
                    <Field label="Make" error={errors[`veh_${i}_make`]}><Input value={veh.make} onChange={v=>uVehicle(i,"make",v)} placeholder="e.g. Toyota" hasError={!!errors[`veh_${i}_make`]}/></Field>
                    <Field label="Model" error={errors[`veh_${i}_model`]}><Input value={veh.model} onChange={v=>uVehicle(i,"model",v)} placeholder="e.g. Tacoma" hasError={!!errors[`veh_${i}_model`]}/></Field>
                  </div>
                  {(() => {
                    const vi = getValuationInfo(veh.type);
                    const canLookup = vi && veh.year && veh.make && veh.model;
                    const res = veh.valuationResult;
                    const isLoading = veh.valuationStatus === "loading";
                    const isDone = veh.valuationStatus === "done";
                    const isErr = veh.valuationStatus === "error";

                    const isVehStale = (() => {
                      const d = veh.valueDate;
                      if (!d) return false;
                      return (Date.now() - new Date(d).getTime()) > 90 * 24 * 60 * 60 * 1000;
                    })();

                    const doLookup = async () => {
                      uVehicle(i, "valuationStatus", "loading");
                      uVehicle(i, "valuationError", null);
                      try {
                        const r = await fetch(`${SUPABASE_URL}/functions/v1/vehicle-value`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
                          body: JSON.stringify({ year: veh.year, make: veh.make, model: veh.model, type: veh.type }),
                        });
                        const d = await r.json();
                        if (d.error) throw new Error(d.error);
                        setData(p => {
                          const a = [...p.vehicles];
                          a[i] = { ...a[i], valuationStatus: "done", valuationResult: d, value: String(d.value || ""), valueDate: new Date().toISOString(), valueConfirmed: false, valuationOverride: false, overrideReason: "", overrideDetails: "" };
                          return { ...p, vehicles: a };
                        });
                      } catch (err) {
                        uVehicle(i, "valuationStatus", "error");
                        uVehicle(i, "valuationError", String(err));
                      }
                    };

                    return (
                      <>
                        {vi && (
                          <div className="mb-4 bg-slate-800/60 border border-slate-600 rounded-xl px-4 py-3">
                            <p className="text-xs text-amber-300 mb-3">
                              <span className="font-semibold">Trustee notice:</span> Trustees typically use {vi.source} to verify vehicle values. Use the button below to fetch the current estimated value — it will auto-populate the field below.
                            </p>
                            <button
                              onClick={doLookup}
                              disabled={!canLookup || isLoading}
                              className={`inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg border transition-all ${canLookup && !isLoading ? "bg-amber-400/10 border-amber-400/50 text-amber-400 hover:bg-amber-400/20 hover:border-amber-400" : "border-slate-600 text-slate-500 cursor-not-allowed"}`}
                            >
                              {isLoading ? (
                                <><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Looking up value…</>
                              ) : (
                                <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/></svg>{vi.label}</>
                              )}
                            </button>
                            {!canLookup && !isLoading && <p className="text-xs text-slate-500 mt-2">Enter year, make, and model above to enable lookup.</p>}
                            {isErr && <p className="text-xs text-red-400 mt-2">Could not retrieve value automatically. Please enter it manually below.</p>}
                            {isDone && res && (
                              <div className="mt-3 bg-green-400/5 border border-green-400/20 rounded-lg px-3 py-2.5">
                                <p className="text-xs font-semibold text-green-400 mb-1">{res.source} estimate retrieved</p>
                                <div className="flex items-end gap-4">
                                  <div>
                                    <p className="text-xs text-slate-400">Estimated Value</p>
                                    <p className="text-lg font-bold text-white">${(res.value||0).toLocaleString()}</p>
                                  </div>
                                  {res.low && res.high && (
                                    <div>
                                      <p className="text-xs text-slate-400">Range</p>
                                      <p className="text-sm text-slate-300">${res.low.toLocaleString()} – ${res.high.toLocaleString()}</p>
                                    </div>
                                  )}
                                </div>
                                <p className="text-xs text-slate-400 mt-1.5">Value auto-populated below. If you believe your vehicle is worth less, use the override option.</p>
                              </div>
                            )}
                          </div>
                        )}

                        <Field label="Estimated Market Value" error={errors[`veh_${i}_value`]}>
                          <Input type="number" value={veh.value} onChange={v=>{ uVehicle(i,"value",v); uVehicle(i,"valueDate",new Date().toISOString()); uVehicle(i,"valueConfirmed",false); }} placeholder="Enter amount" hasError={!!errors[`veh_${i}_value`]}/>
                        </Field>

                        {veh.valueDate && (
                          <p className="text-xs text-slate-500 -mt-3 mb-3">
                            Value last verified: <span className="text-slate-400">{new Date(veh.valueDate).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span>
                          </p>
                        )}

                        {isVehStale && (
                          <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/40 rounded-xl flex gap-3 items-start">
                            <svg className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                            <div className="flex-1">
                              <p className="text-xs font-semibold text-amber-300 mb-1">Value is more than 90 days old — please update</p>
                              <p className="text-xs text-amber-200/70 mb-2">Your vehicle value was last verified over 90 days ago. Please click "{vi?.label || "Look Up Value"}" above to get a current estimate, or visit KBB directly to update the value.</p>
                              <a href={vi?.url || "https://www.kbb.com/whats-my-car-worth/"} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                                Check current value on {vi?.source || "KBB"}
                              </a>
                            </div>
                          </div>
                        )}

                        {veh.value && !isVehStale && (
                          <label className="flex items-start gap-3 mb-4 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={!!veh.valueConfirmed}
                              onChange={e=>uVehicle(i,"valueConfirmed",e.target.checked)}
                              className="mt-0.5 w-4 h-4 rounded border-slate-500 bg-slate-800 text-amber-400 focus:ring-amber-400/30 flex-shrink-0"
                            />
                            <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors leading-relaxed">
                              I confirm this value is accurate and current as of today. I understand that an inaccurate value may affect my bankruptcy case.
                            </span>
                          </label>
                        )}

                        {isDone && res && !veh.valuationOverride && (
                          <div className="mb-4 -mt-2">
                            <button
                              onClick={()=>{ uVehicle(i,"valuationOverride",true); }}
                              className="text-xs text-slate-400 hover:text-amber-400 underline underline-offset-2 transition-colors"
                            >
                              I believe my vehicle is worth less than this estimate
                            </button>
                          </div>
                        )}

                        {veh.valuationOverride && (
                          <div className="mb-4 bg-blue-500/5 border border-blue-500/20 rounded-xl px-4 py-3">
                            <p className="text-xs font-semibold text-blue-300 mb-3">Why do you believe your vehicle is worth less?</p>
                            <div className="grid grid-cols-2 gap-2 mb-3">
                              {["High mileage","Accident/damage history","Mechanical issues","Cosmetic damage","Missing features","Other"].map(reason => (
                                <button
                                  key={reason}
                                  onClick={()=>uVehicle(i,"overrideReason",veh.overrideReason===reason?"":reason)}
                                  className={`text-xs px-3 py-2 rounded-lg border text-left transition-all ${veh.overrideReason===reason?"bg-blue-500/20 border-blue-400 text-blue-300":"bg-slate-800 border-slate-600 text-slate-400 hover:border-blue-400/40"}`}
                                >
                                  {reason}
                                </button>
                              ))}
                            </div>
                            <div>
                              <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Additional Details <span className="normal-case font-normal text-slate-500">(optional)</span></label>
                              <textarea
                                value={veh.overrideDetails}
                                onChange={e=>uVehicle(i,"overrideDetails",e.target.value)}
                                placeholder="Describe any condition issues, damage, mileage, or other factors affecting value…"
                                rows={3}
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-400 resize-none"
                              />
                            </div>
                            <button
                              onClick={()=>{ uVehicle(i,"valuationOverride",false); uVehicle(i,"overrideReason",""); uVehicle(i,"overrideDetails",""); }}
                              className="text-xs text-slate-500 hover:text-slate-300 mt-2 underline underline-offset-2 transition-colors"
                            >
                              Cancel override
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                  <Field label="What do you intend to do with this vehicle?" error={errors[`veh_${i}_intent`]}>
                    <RadioGroup name={`veh_${i}_intent`} current={veh.intent} onChange={v=>uVehicle(i,"intent",v)} error={errors[`veh_${i}_intent`]}
                      options={[{value:"keep",label:"Keep — I want to keep this vehicle and continue paying"},{value:"surrender",label:"Surrender — I wish to give this vehicle back to the lender"}]}/>
                  </Field>
                  {veh.intent==="surrender" && (
                    <div className="mt-1 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300">
                      This vehicle will be surrendered. Its loan will not be factored into your plan funding requirements.
                    </div>
                  )}
                  <Field label="Is there a loan on this vehicle?" error={errors[`veh_${i}_hasLoan`]}>
                    <RadioGroup name={`veh_${i}_loan`} current={veh.hasLoan} onChange={v=>uVehicle(i,"hasLoan",v)} error={errors[`veh_${i}_hasLoan`]}
                      options={[{value:"yes",label:"Yes — there is a loan"},{value:"no",label:"No — owned free and clear"}]}/>
                  </Field>
                  {veh.hasLoan==="yes" && (
                    <>
                      <Field label="Lender Name">
                        <Input value={veh.lenderName||""} onChange={v=>uVehicle(i,"lenderName",v)} placeholder="e.g. Toyota Financial, Chase Auto, Capital One"/>
                      </Field>
                      <div className="grid grid-cols-2 gap-3 mt-1">
                        <Field label="Loan Balance" error={errors[`veh_${i}_loanBalance`]}>
                          <Input type="number" value={veh.loanBalance} onChange={v=>uVehicle(i,"loanBalance",v)} placeholder="Enter amount" hasError={!!errors[`veh_${i}_loanBalance`]}/>
                        </Field>
                        <Field label="Monthly Payment" error={errors[`veh_${i}_monthlyPayment`]}>
                          <Input type="number" value={veh.monthlyPayment} onChange={v=>uVehicle(i,"monthlyPayment",v)} placeholder="Enter amount" hasError={!!errors[`veh_${i}_monthlyPayment`]}/>
                        </Field>
                      </div>
                      <Field label="Interest Rate (APR %)" hint="Check your loan statement or contact your lender. Used to calculate your Ch. 13 plan payment — the lower of your contract rate or the Till rate (prime + 3%) will apply.">
                        <Input type="number" value={veh.interestRate} onChange={v=>uVehicle(i,"interestRate",v)} placeholder="e.g. 6.99" hasError={false}/>
                      </Field>
                    </>
                  )}
                  {veh.hasLoan==="no" && veh.value && (
                    <div className="mt-1 p-2 bg-slate-800/60 border border-slate-600 rounded-lg text-xs text-slate-400">
                      Owned free and clear — estimated equity of <span className="text-white font-semibold">${(parseFloat(veh.value)||0).toLocaleString()}</span>. Your attorney will review whether an exemption applies.
                    </div>
                  )}

                  {/* Ownership Questions */}
                  <div className="mt-4 pt-4 border-t border-slate-700/60">
                    <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Ownership</h4>
                    <Field label={data.filingType==="joint"||data.filingType==="individual-nonfiling-spouse" ? "Who owns this vehicle?" : "Is this vehicle 100% owned by you?"} error={errors[`veh_${i}_ownershipType`]}>
                      <RadioGroup
                        name={`veh_${i}_ownershipType`}
                        current={veh.ownershipType}
                        onChange={v=>uVehicle(i,"ownershipType",v)}
                        error={errors[`veh_${i}_ownershipType`]}
                        options={
                          data.filingType==="joint"
                            ? [{value:"debtor1",label:"Debtor 1 only"},{value:"debtor2",label:"Debtor 2 only"},{value:"both",label:"Owned jointly by both debtors"}]
                            : data.filingType==="individual-nonfiling-spouse"
                            ? [{value:"debtor1",label:"Debtor only (100%)"},{value:"spouse",label:"Non-filing spouse only (100%)"},{value:"both",label:"Owned jointly with non-filing spouse"}]
                            : [{value:"debtor1",label:"Yes — 100% owned by me"},{value:"partial",label:"No — I share ownership with another person"}]
                        }
                      />
                    </Field>

                    {(data.filingType==="joint"||data.filingType==="individual-nonfiling-spouse") && (veh.ownershipType==="debtor1"||veh.ownershipType==="spouse") && (
                      <>
                        <Field label="Was this vehicle owned before the marriage?" error={errors[`veh_${i}_ownedBeforeMarriage`]}>
                          <RadioGroup
                            name={`veh_${i}_ownedBeforeMarriage`}
                            current={veh.ownedBeforeMarriage}
                            onChange={v=>{ uVehicle(i,"ownedBeforeMarriage",v); if(v==="no"){ uVehicle(i,"maritalFundsUsed",""); uVehicle(i,"hasPrenup",""); uVehicle(i,"inheritedOrGift",""); } }}
                            error={errors[`veh_${i}_ownedBeforeMarriage`]}
                            options={[{value:"yes",label:"Yes — owned before marriage"},{value:"no",label:"No — acquired during marriage"},{value:"unknown",label:"Unsure"}]}
                          />
                        </Field>

                        {veh.ownedBeforeMarriage==="yes" && (
                          <>
                            <Field label="Was this vehicle inherited or received as a gift?" error={errors[`veh_${i}_inheritedOrGift`]}>
                              <RadioGroup
                                name={`veh_${i}_inheritedOrGift`}
                                current={veh.inheritedOrGift}
                                onChange={v=>uVehicle(i,"inheritedOrGift",v)}
                                error={errors[`veh_${i}_inheritedOrGift`]}
                                options={[{value:"yes",label:"Yes — inherited or gifted to me alone"},{value:"no",label:"No — I purchased it"},{value:"unsure",label:"Unsure"}]}
                              />
                            </Field>
                            <Field label="Were any marital (community) funds ever used to pay for, maintain, or improve this vehicle?" error={errors[`veh_${i}_maritalFundsUsed`]}>
                              <RadioGroup
                                name={`veh_${i}_maritalFundsUsed`}
                                current={veh.maritalFundsUsed}
                                onChange={v=>uVehicle(i,"maritalFundsUsed",v)}
                                error={errors[`veh_${i}_maritalFundsUsed`]}
                                options={[{value:"yes",label:"Yes — marital funds were used"},{value:"no",label:"No — only separate property funds used"},{value:"unsure",label:"Unsure"}]}
                              />
                            </Field>
                            {(veh.maritalFundsUsed==="yes"||veh.maritalFundsUsed==="unsure") && (
                              <>
                                <Field label="Is there a prenuptial agreement that designates this as separate property?" error={errors[`veh_${i}_hasPrenup`]}>
                                  <RadioGroup
                                    name={`veh_${i}_hasPrenup`}
                                    current={veh.hasPrenup}
                                    onChange={v=>{ uVehicle(i,"hasPrenup",v); uVehicle(i,"communityPropFlag",v==="no"||v==="unsure"); }}
                                    error={errors[`veh_${i}_hasPrenup`]}
                                    options={[{value:"yes",label:"Yes — there is a prenup covering this asset"},{value:"no",label:"No prenup"},{value:"unsure",label:"Unsure"}]}
                                  />
                                </Field>
                                {(veh.hasPrenup==="no"||veh.hasPrenup==="unsure") && (
                                  <div className="mt-1 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 flex gap-2">
                                    <span className="text-red-400 flex-shrink-0">⚑</span>
                                    <span><strong>Attorney Review Required:</strong> This vehicle may have been <em>transmuted</em> to community property because marital funds were used without a prenuptial agreement protecting it as separate property. Your attorney will need to evaluate this carefully before filing.</span>
                                  </div>
                                )}
                              </>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
              <button onClick={addVehicle} className="w-full border border-dashed border-amber-400/40 hover:border-amber-400 text-amber-400 text-sm font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 mb-2">
                <span className="text-lg">+</span> Add Another Vehicle
              </button>
              {financedVehicles().length>0 && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs text-blue-300">
                  📋 {financedVehicles().length} financed vehicle{financedVehicles().length>1?"s":""} — payments will auto-populate in Schedule J
                </div>
              )}
            </>}
          </SectionCard>

          <SectionCard title="Bank & Deposit Accounts — Schedule A/B" icon="🏦">
            <Field label="Do you have any bank or deposit accounts?" error={e("hasBankAccounts")}>
              <RadioGroup name="hasBankAccounts" current={data.hasBankAccounts} onChange={v=>u("hasBankAccounts",v)} error={e("hasBankAccounts")}
                options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
            </Field>
            {data.hasBankAccounts==="yes" && <>
              {data.bankAccounts.map((acc,i)=>(
                <div key={acc.id} className="bg-slate-900/60 border border-slate-600 rounded-xl p-4 mb-3">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Account {i+1}</p>
                    {data.bankAccounts.length>1 && <button onClick={()=>remArr("bankAccounts",i)} className="text-xs text-red-400 border border-red-400/30 px-2 py-1 rounded-lg">Remove</button>}
                  </div>
                  <Field label="Bank Name" error={errors[`ba_${i}_bankName`]}><Input value={acc.bankName} onChange={v=>uArr("bankAccounts",i,"bankName",v)} placeholder="e.g. Chase, Wells Fargo" hasError={!!errors[`ba_${i}_bankName`]}/></Field>
                  <Field label="Account Type" error={errors[`ba_${i}_accountType`]}>
                    <Select value={acc.accountType} onChange={v=>uArr("bankAccounts",i,"accountType",v)} hasError={!!errors[`ba_${i}_accountType`]}
                      options={["Checking","Savings","Money Market","Certificate of Deposit (CD)","Credit Union Share","Other"]} placeholder="Select account type..."/>
                  </Field>
                  <Field label="Current Balance" error={errors[`ba_${i}_balance`]}><Input type="number" value={acc.balance} onChange={v=>uArr("bankAccounts",i,"balance",v)} placeholder="Enter amount" hasError={!!errors[`ba_${i}_balance`]}/></Field>
                </div>
              ))}
              <button onClick={()=>addArr("bankAccounts",emptyBank)} className="w-full border border-dashed border-amber-400/40 hover:border-amber-400 text-amber-400 text-sm font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                <span className="text-lg">+</span> Add Another Account
              </button>
            </>}
          </SectionCard>

          <SectionCard title="Retirement Accounts — Schedule A/B" icon="🏛️">
            <Field label="Do you have any retirement or pension accounts?" error={e("hasRetirement")}>
              <RadioGroup name="hasRetirement" current={data.hasRetirement} onChange={v=>u("hasRetirement",v)} error={e("hasRetirement")}
                options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
            </Field>
            {data.hasRetirement==="yes" && (
              <div>
                {data.retirementAccounts.map((acct, i) => {
                  const acctDef = RETIREMENT_TYPES.find(t=>t.value===acct.accountType);
                  const bal = parseFloat(acct.balance)||0;
                  const overCap = acctDef?.iraCapApplies && bal > IRA_CAP;
                  return (
                    <div key={acct.id} className="bg-slate-900/60 border border-slate-600 rounded-xl p-4 mb-3">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Account {i+1}</p>
                        {data.retirementAccounts.length>1 && <button onClick={()=>remArr("retirementAccounts",i)} className="text-xs text-red-400 border border-red-400/30 px-2 py-1 rounded-lg">Remove</button>}
                      </div>
                      <Field label="Account Type" error={errors[`ra_${i}_accountType`]}>
                        <Select value={acct.accountType} onChange={v=>uArr("retirementAccounts",i,"accountType",v)} hasError={!!errors[`ra_${i}_accountType`]}
                          options={RETIREMENT_TYPES.map(t=>({value:t.value,label:t.label}))} placeholder="Select account type..."/>
                      </Field>
                      {acctDef && (
                        <div className={`p-2 rounded-lg mb-3 text-xs ${acctDef.exempt===false?"bg-red-400/10 border border-red-400/30 text-red-300":acctDef.erisa||acctDef.iraCapApplies?"bg-green-400/10 border border-green-400/30 text-green-300":"bg-amber-400/10 border border-amber-400/30 text-amber-300"}`}>
                          {acctDef.note}
                        </div>
                      )}
                      <Field label="Financial Institution" error={errors[`ra_${i}_institution`]}><Input value={acct.institution} onChange={v=>uArr("retirementAccounts",i,"institution",v)} placeholder="e.g. Fidelity, Vanguard" hasError={!!errors[`ra_${i}_institution`]}/></Field>
                      <Field label="Current Balance" error={errors[`ra_${i}_balance`]}><Input type="number" value={acct.balance} onChange={v=>uArr("retirementAccounts",i,"balance",v)} placeholder="Enter amount" hasError={!!errors[`ra_${i}_balance`]}/></Field>
                      {overCap && (
                        <div className="p-2 rounded-lg mb-2 text-xs bg-slate-800/60 border border-slate-600 text-slate-400">
                          Balance exceeds the § 522(n) IRA cap of ${IRA_CAP.toLocaleString()}. Your attorney will review how this affects the exemption analysis for this account.
                        </div>
                      )}
                    </div>
                  );
                })}
                <button onClick={()=>addArr("retirementAccounts",emptyRetirementAccount)} className="w-full border border-dashed border-amber-400/40 hover:border-amber-400 text-amber-400 text-sm font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 mb-3">
                  <span className="text-lg">+</span> Add Another Account
                </button>
                <div className="p-3 bg-slate-800 border border-slate-700 rounded-xl">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400">Total Retirement Balance</span>
                    <span className="text-lg font-serif font-bold text-amber-400">${retirementTotal().toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                  </div>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Life Insurance Policies — Schedule A/B" icon="🛡️">
            <Field label="Do you own any life insurance policies?" error={e("hasLifeInsurance")}>
              <RadioGroup name="hasLI" current={data.hasLifeInsurance} onChange={v=>u("hasLifeInsurance",v)} error={e("hasLifeInsurance")}
                options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
            </Field>
            {data.hasLifeInsurance==="yes" && <>
              {data.lifePolicies.map((pol,i)=>{
                const days = daysOwned(pol.purchaseDate);
                const seasoned = isSeasoned(pol.purchaseDate);
                const isCashValue = ["whole","universal","other"].includes(pol.policyType);
                return (
                  <div key={pol.id} className={`bg-slate-900/60 border rounded-xl p-4 mb-3 ${seasoned===false && isCashValue ? "border-red-500/50" : "border-slate-600"}`}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Policy {i+1}</p>
                      {data.lifePolicies.length>1 && <button onClick={()=>remArr("lifePolicies",i)} className="text-xs text-red-400 border border-red-400/30 px-2 py-1 rounded-lg">Remove</button>}
                    </div>
                    <Field label="Policy Type" error={errors[`lp_${i}_policyType`]}>
                      <RadioGroup name={`lp_${i}_type`} current={pol.policyType} onChange={v=>uArr("lifePolicies",i,"policyType",v)} error={errors[`lp_${i}_policyType`]}
                        options={[{value:"term",label:"Term Life"},{value:"whole",label:"Whole Life"},{value:"universal",label:"Universal Life"},{value:"other",label:"Other"}]}/>
                    </Field>
                    <Field label="Policy Purchase / Issue Date" error={errors[`lp_${i}_purchaseDate`]}>
                      <Input type="date" value={pol.purchaseDate} onChange={v=>uArr("lifePolicies",i,"purchaseDate",v)} hasError={!!errors[`lp_${i}_purchaseDate`]}/>
                    </Field>
                    {pol.purchaseDate && isCashValue && (
                      <div className={`p-3 rounded-lg mb-3 text-xs border ${seasoned ? "bg-blue-400/10 border-blue-400/30 text-blue-300" : "bg-amber-400/10 border-amber-400/30 text-amber-300"}`}>
                        {seasoned
                          ? <>ℹ️ Owned approximately <strong>{days?.toLocaleString()} days</strong> — attorney will review applicable protections.</>
                          : <>⚠️ Owned approximately <strong>{days?.toLocaleString()} days</strong> ({Math.round((days||0)/30)} months) — 2-year seasoning rule may apply. Attorney review required.</>
                        }
                      </div>
                    )}
                    <Field label="Face Value / Death Benefit"><Input type="number" value={pol.faceValue} onChange={v=>uArr("lifePolicies",i,"faceValue",v)} placeholder="Enter amount"/></Field>
                    {isCashValue && (
                      <Field label="Cash Surrender Value" error={errors[`lp_${i}_cashValue`]}>
                        <Input type="number" value={pol.cashValue} onChange={v=>uArr("lifePolicies",i,"cashValue",v)} placeholder="Enter amount" hasError={!!errors[`lp_${i}_cashValue`]}/>
                      </Field>
                    )}
                    <Field label="Beneficiary" error={errors[`lp_${i}_beneficiary`]}>
                      <Input value={pol.beneficiary} onChange={v=>uArr("lifePolicies",i,"beneficiary",v)} placeholder="e.g. Jane Smith (spouse)" hasError={!!errors[`lp_${i}_beneficiary`]}/>
                    </Field>
                  </div>
                );
              })}
              <button onClick={()=>addArr("lifePolicies",emptyPolicy)} className="w-full border border-dashed border-amber-400/40 hover:border-amber-400 text-amber-400 text-sm font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                <span className="text-lg">+</span> Add Another Policy
              </button>
            </>}
          </SectionCard>

          <SectionCard title="Annuities — Schedule A/B" icon="📈">
            <Field label="Do you own any annuities?" error={e("hasAnnuities")}>
              <RadioGroup name="hasAnn" current={data.hasAnnuities} onChange={v=>u("hasAnnuities",v)} error={e("hasAnnuities")}
                options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
            </Field>
            {data.hasAnnuities==="yes" && <>
              {data.annuities.map((ann,i)=>{
                const days = daysOwned(ann.purchaseDate);
                const seasoned = isSeasoned(ann.purchaseDate);
                return (
                  <div key={ann.id} className={`bg-slate-900/60 border rounded-xl p-4 mb-3 ${seasoned===false ? "border-red-500/50" : "border-slate-600"}`}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Annuity {i+1}</p>
                      {data.annuities.length>1 && <button onClick={()=>remArr("annuities",i)} className="text-xs text-red-400 border border-red-400/30 px-2 py-1 rounded-lg">Remove</button>}
                    </div>
                    <Field label="Annuity Type">
                      <Select value={ann.annuityType} onChange={v=>uArr("annuities",i,"annuityType",v)}
                        options={["Fixed Annuity","Variable Annuity","Indexed Annuity","Deferred Annuity","Immediate Annuity","Other"]} placeholder="Select type..."/>
                    </Field>
                    <Field label="Purchase / Issue Date" error={errors[`an_${i}_purchaseDate`]}>
                      <Input type="date" value={ann.purchaseDate} onChange={v=>uArr("annuities",i,"purchaseDate",v)} hasError={!!errors[`an_${i}_purchaseDate`]}/>
                    </Field>
                    {ann.purchaseDate && (
                      <div className={`p-3 rounded-lg mb-3 text-xs border ${seasoned ? "bg-blue-400/10 border-blue-400/30 text-blue-300" : "bg-amber-400/10 border-amber-400/30 text-amber-300"}`}>
                        {seasoned
                          ? <>ℹ️ Owned approximately <strong>{days?.toLocaleString()} days</strong>.</>
                          : <>⚠️ Owned approximately <strong>{days?.toLocaleString()} days</strong> ({Math.round((days||0)/30)} months) — attorney review recommended.</>
                        }
                      </div>
                    )}
                    <Field label="Current Value" error={errors[`an_${i}_currentValue`]}><Input type="number" value={ann.currentValue} onChange={v=>uArr("annuities",i,"currentValue",v)} placeholder="Enter amount" hasError={!!errors[`an_${i}_currentValue`]}/></Field>
                    <Field label="Beneficiary" error={errors[`an_${i}_beneficiary`]}><Input value={ann.beneficiary} onChange={v=>uArr("annuities",i,"beneficiary",v)} placeholder="e.g. John Smith (son)" hasError={!!errors[`an_${i}_beneficiary`]}/></Field>
                  </div>
                );
              })}
              <button onClick={()=>addArr("annuities",emptyAnnuity)} className="w-full border border-dashed border-amber-400/40 hover:border-amber-400 text-amber-400 text-sm font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                <span className="text-lg">+</span> Add Another Annuity
              </button>
            </>}
          </SectionCard>

          <SectionCard title="Claims & Money Owed — Schedule A/B" icon="⚖️">
            <Field label="Do you have any pending claims, lawsuits, or money owed to you?" error={e("hasPendingClaims")}>
              <RadioGroup name="hasClaims" current={data.hasPendingClaims} onChange={v=>u("hasPendingClaims",v)} error={e("hasPendingClaims")}
                options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
            </Field>
            {data.hasPendingClaims==="yes" && (
              <Field label="Describe the claim(s)" error={e("pendingClaimsDesc")}>
                <Input value={data.pendingClaimsDesc} onChange={v=>u("pendingClaimsDesc",v)} placeholder="Nature of the claim, who owes you, status" hasError={!!e("pendingClaimsDesc")}/>
              </Field>
            )}
            <Field label="Do you have a pending Social Security claim or appeal?" error={e("hasSsClaim")}>
              <RadioGroup name="hasSsClaim" current={data.hasSsClaim} onChange={v=>u("hasSsClaim",v)} error={e("hasSsClaim")}
                options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
            </Field>
            {data.hasSsClaim==="yes" && (
              <Field label="Describe the Social Security claim (type, status, expected amount)" error={e("ssPendingDesc")}>
                <Input value={data.ssPendingDesc} onChange={v=>u("ssPendingDesc",v)} placeholder="e.g. SSDI appeal pending, expected award $15,000 back pay" hasError={!!e("ssPendingDesc")}/>
              </Field>
            )}
            <Field label="Have you received any Social Security back pay (lump sum payment)?" error={e("hasSsBackPay")}>
              <RadioGroup name="hasSsBackPay" current={data.hasSsBackPay} onChange={v=>u("hasSsBackPay",v)} error={e("hasSsBackPay")}
                options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
            </Field>
            {data.hasSsBackPay==="yes" && (
              <>
                <Field label="Amount of Social Security back pay received" error={e("ssBackPayAmount")}>
                  <Input type="number" value={data.ssBackPayAmount} onChange={v=>u("ssBackPayAmount",v)} placeholder="Enter amount" hasError={!!e("ssBackPayAmount")}/>
                </Field>
                <Field label="Is the Social Security back pay kept in a separate, dedicated bank account?" error={e("ssBackPaySegregated")}>
                  <RadioGroup name="ssBackPaySegregated" current={data.ssBackPaySegregated} onChange={v=>u("ssBackPaySegregated",v)} error={e("ssBackPaySegregated")}
                    options={[{value:"yes",label:"Yes — it is in its own account"},{value:"no",label:"No — it has been mixed with other funds"}]}/>
                </Field>
                {data.ssBackPaySegregated==="yes" && (
                  <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/25 text-xs text-green-300 leading-relaxed">
                    <p className="font-bold mb-1">Protected — Keep It Separate</p>
                    <p>Social Security back pay that is kept in its own dedicated account and <strong>not co-mingled</strong> with other funds is protected from the bankruptcy trustee under federal law (42 U.S.C. § 407). As long as it remains segregated, this money should be safe. <strong>Do not transfer it or mix it with other money before consulting your attorney.</strong></p>
                  </div>
                )}
                {data.ssBackPaySegregated==="no" && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-300 leading-relaxed">
                    <p className="font-bold mb-1">Attorney Review Required — Co-Mingling Risk</p>
                    <p>When Social Security back pay is mixed ("co-mingled") with other funds, the protection under 42 U.S.C. § 407 may be lost. Your attorney must review this. <strong>Do not spend or move this money until you speak with your attorney.</strong></p>
                  </div>
                )}
              </>
            )}
            {data.hasSsBackPay==="no" && data.hasSsClaim==="yes" && (
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/25 text-xs text-blue-300 leading-relaxed">
                <p className="font-bold mb-1">Important: If You Receive SS Back Pay Before Filing</p>
                <p>If you are awarded Social Security back pay before your bankruptcy case is filed, <strong>deposit it into its own dedicated bank account and do not mix it with any other funds.</strong> Social Security back pay kept in a segregated account is protected from the bankruptcy trustee under federal law (42 U.S.C. § 407). Your attorney will advise you on this.</p>
              </div>
            )}
            <Field label="Is anyone owing you money (loans, deposits, tax refunds, etc.)?" error={e("hasMoneyOwed")}>
              <RadioGroup name="hasMoneyOwed" current={data.hasMoneyOwed} onChange={v=>u("hasMoneyOwed",v)} error={e("hasMoneyOwed")}
                options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
            </Field>
            {data.hasMoneyOwed==="yes" && (
              <Field label="Describe what is owed and by whom" error={e("moneyOwedDesc")}>
                <Input value={data.moneyOwedDesc} onChange={v=>u("moneyOwedDesc",v)} placeholder="e.g. $2,000 personal loan to brother" hasError={!!e("moneyOwedDesc")}/>
              </Field>
            )}
          </SectionCard>

          <SectionCard title="Household & Personal Property — Schedule A/B" icon="💰">
            <p className="text-xs text-slate-400 mb-3">Enter the estimated <span className="text-white font-semibold">fair market value</span> — what a willing buyer would pay today, not the original retail price. List all assets owned by anyone in the household. Use "I don't have this" to skip items that don't apply.</p>
            <ExpenseField label="Household Goods & Furniture" hint="Sofas, beds, tables, appliances, kitchenware, and other furnishings" error={e("householdGoodsValue")} value={data.householdGoodsValue} onChange={v=>u("householdGoodsValue",v)} badge="Fair Market Value"/>
            <ExpenseField label="Electronics" hint="Phones, computers, tablets, TVs, gaming consoles, cameras, and similar devices" error={e("electronicsValue")} value={data.electronicsValue} onChange={v=>u("electronicsValue",v)} badge="Fair Market Value"/>
            <ExpenseField label="Jewelry & Watches" hint="Rings, necklaces, bracelets, watches — include all household members' items" error={e("jewelryValue")} value={data.jewelryValue} onChange={v=>u("jewelryValue",v)} badge="Fair Market Value"/>
            <ExpenseField label="Work Tools & Equipment" hint="Hand tools, power tools, professional equipment used for work or trade" error={e("toolsValue")} value={data.toolsValue} onChange={v=>u("toolsValue",v)} badge="Fair Market Value"/>
            <Field label="Do you own stocks, bonds, or brokerage accounts?" error={e("hasStocks")}>
              <RadioGroup name="hasStocks" current={data.hasStocks} onChange={v=>u("hasStocks",v)} error={e("hasStocks")}
                options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
            </Field>
            {data.hasStocks==="yes" && <>
              <Field label="Total Estimated Value" error={e("stocksValue")}><Input type="number" value={data.stocksValue} onChange={v=>u("stocksValue",v)} placeholder="Enter amount" hasError={!!e("stocksValue")}/></Field>
              <Field label="Describe Your Holdings" error={e("stocksDesc")}><Input value={data.stocksDesc} onChange={v=>u("stocksDesc",v)} placeholder="Brokerage and types of holdings" hasError={!!e("stocksDesc")}/></Field>
            </>}
            <Field label="Do you own any cryptocurrency?" error={e("hasCrypto")}>
              <RadioGroup name="hasCrypto" current={data.hasCrypto} onChange={v=>u("hasCrypto",v)} error={e("hasCrypto")}
                options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
            </Field>
            {data.hasCrypto==="yes" && <>
              <Field label="Total Current Value (USD)" error={e("cryptoValue")}><Input type="number" value={data.cryptoValue} onChange={v=>u("cryptoValue",v)} placeholder="Enter amount" hasError={!!e("cryptoValue")}/></Field>
              <Field label="Describe Your Holdings" error={e("cryptoDesc")}><Input value={data.cryptoDesc} onChange={v=>u("cryptoDesc",v)} placeholder="Coin types, amounts, where held" hasError={!!e("cryptoDesc")}/></Field>
            </>}
            <Field label="Do you own any firearms?" error={e("hasFirearms")}>
              <RadioGroup name="hasFirearms" current={data.hasFirearms} onChange={v=>u("hasFirearms",v)} error={e("hasFirearms")}
                options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
            </Field>
            {data.hasFirearms==="yes" && <>
              {data.firearms.map((fa,i)=>(
                <div key={fa.id} className="bg-slate-900/60 border border-slate-600 rounded-xl p-4 mb-3">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Firearm {i+1}</p>
                    {data.firearms.length>1 && <button onClick={()=>remArr("firearms",i)} className="text-xs text-red-400 border border-red-400/30 px-2 py-1 rounded-lg">Remove</button>}
                  </div>
                  <Field label="Description" error={errors[`fa_${i}_description`]}><Input value={fa.description} onChange={v=>uArr("firearms",i,"description",v)} placeholder="e.g. 2018 Glock 19 9mm pistol" hasError={!!errors[`fa_${i}_description`]}/></Field>
                  <Field label="Estimated Resale Value" error={errors[`fa_${i}_value`]}><Input type="number" value={fa.value} onChange={v=>uArr("firearms",i,"value",v)} placeholder="Enter amount" hasError={!!errors[`fa_${i}_value`]}/></Field>
                </div>
              ))}
              <button onClick={()=>addArr("firearms",emptyFirearm)} className="w-full border border-dashed border-amber-400/40 hover:border-amber-400 text-amber-400 text-sm font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                <span className="text-lg">+</span> Add Another Firearm
              </button>
            </>}
            <Field label="Do you have any collectibles, artwork, or other valuables?" error={e("hasCollectibles")}>
              <RadioGroup name="hasCollectibles" current={data.hasCollectibles} onChange={v=>u("hasCollectibles",v)} error={e("hasCollectibles")}
                options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
            </Field>
            {data.hasCollectibles==="yes" && <>
              <Field label="Total Estimated Value" error={e("collectiblesValue")}><Input type="number" value={data.collectiblesValue} onChange={v=>u("collectiblesValue",v)} placeholder="Enter amount" hasError={!!e("collectiblesValue")}/></Field>
              <Field label="Describe Your Collectibles" error={e("collectiblesDesc")}><Input value={data.collectiblesDesc} onChange={v=>u("collectiblesDesc",v)} placeholder="Type and approximate value" hasError={!!e("collectiblesDesc")}/></Field>
            </>}
            <Field label="Any other personal property not listed?" error={e("hasOtherPersonalProp")}>
              <RadioGroup name="hasOtherPP" current={data.hasOtherPersonalProp} onChange={v=>u("hasOtherPersonalProp",v)} error={e("hasOtherPersonalProp")}
                options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
            </Field>
            {data.hasOtherPersonalProp==="yes" && <>
              <Field label="Total Estimated Value" error={e("otherPersonalPropValue")}><Input type="number" value={data.otherPersonalPropValue} onChange={v=>u("otherPersonalPropValue",v)} placeholder="Enter amount" hasError={!!e("otherPersonalPropValue")}/></Field>
              <Field label="Describe the Property" error={e("otherPersonalPropDesc")}><Input value={data.otherPersonalPropDesc} onChange={v=>u("otherPersonalPropDesc",v)} placeholder="What it is, where it is" hasError={!!e("otherPersonalPropDesc")}/></Field>
            </>}
          </SectionCard>

          <SectionCard title="Business Property — Schedule A/B" icon="🏭">
            <p className="text-xs text-slate-400 mb-3 leading-relaxed">If you own or have owned a business, you must list <strong className="text-white">all business-related property</strong> on your schedules. This includes property even if the business is currently inactive or closed.</p>
            <Field label="Do you own any business property or have any interest in a business?" error={e("hasBusinessAssets")}>
              <RadioGroup name="hasBusinessAssets" current={data.hasBusinessAssets} onChange={v=>u("hasBusinessAssets",v)} error={e("hasBusinessAssets")}
                options={[{value:"yes",label:"Yes — I own or have an interest in a business"},{value:"no",label:"No"}]}/>
            </Field>
            {data.hasBusinessAssets==="yes" && <>
              <div className="p-3 mb-3 rounded-xl bg-blue-500/10 border border-blue-500/25 text-xs text-blue-300 leading-relaxed">
                <p className="font-bold mb-1">Include all categories that apply. Enter each asset type separately.</p>
                <p>Examples: inventory, equipment &amp; machinery, accounts receivable, tools of the trade, intellectual property (patents, trademarks, licenses), and any other business property.</p>
              </div>
              {data.businessAssets.map((ba,i)=>(
                <div key={ba.id} className="bg-slate-900/60 border border-slate-600 rounded-xl p-4 mb-3">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Business Asset {i+1}</p>
                    {data.businessAssets.length>1 && <button onClick={()=>remArr("businessAssets",i)} className="text-xs text-red-400 border border-red-400/30 px-2 py-1 rounded-lg">Remove</button>}
                  </div>
                  <Field label="Asset Type" error={errors[`biz_${i}_assetType`]}>
                    <Select value={ba.assetType} onChange={v=>uArr("businessAssets",i,"assetType",v)} hasError={!!errors[`biz_${i}_assetType`]}
                      options={[
                        {value:"inventory", label:"Inventory / Stock"},
                        {value:"equipment", label:"Equipment & Machinery"},
                        {value:"receivables", label:"Accounts Receivable"},
                        {value:"tools", label:"Tools of the Trade"},
                        {value:"intellectual_property", label:"Intellectual Property (patents, trademarks, licenses, software)"},
                        {value:"furniture_fixtures", label:"Office Furniture & Fixtures"},
                        {value:"vehicles_commercial", label:"Commercial Vehicles"},
                        {value:"real_property_business", label:"Business Real Property"},
                        {value:"contracts", label:"Contracts / Customer Lists"},
                        {value:"goodwill", label:"Goodwill"},
                        {value:"other_business", label:"Other Business Property"},
                      ]} placeholder="Select asset type..."/>
                  </Field>
                  <Field label="Description" error={errors[`biz_${i}_description`]}>
                    <Input value={ba.description} onChange={v=>uArr("businessAssets",i,"description",v)} placeholder="Describe the asset in detail" hasError={!!errors[`biz_${i}_description`]}/>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Estimated Current Value" error={errors[`biz_${i}_estimatedValue`]}>
                      <Input type="number" value={ba.estimatedValue} onChange={v=>uArr("businessAssets",i,"estimatedValue",v)} placeholder="Enter amount" hasError={!!errors[`biz_${i}_estimatedValue`]}/>
                    </Field>
                    <Field label="Amount Owed / Lien Balance (if any)">
                      <Input type="number" value={ba.owedOnIt} onChange={v=>uArr("businessAssets",i,"owedOnIt",v)} placeholder="0 if none"/>
                    </Field>
                  </div>
                  {ba.owedOnIt && parseFloat(ba.owedOnIt)>0 && (
                    <Field label="Lien Holder / Creditor Name">
                      <Input value={ba.lienHolder} onChange={v=>uArr("businessAssets",i,"lienHolder",v)} placeholder="Name of lender or lienholder"/>
                    </Field>
                  )}
                </div>
              ))}
              <button onClick={()=>addArr("businessAssets",emptyBusinessAsset)} className="w-full border border-dashed border-amber-400/40 hover:border-amber-400 text-amber-400 text-sm font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 mb-2">
                <span className="text-lg">+</span> Add Another Business Asset
              </button>
              <div className="p-3 rounded-xl bg-amber-400/5 border border-amber-400/20 text-xs text-amber-300 leading-relaxed">
                <p className="font-bold mb-1">Attorney Will Review</p>
                <p>Your attorney will evaluate whether any business exemptions apply (e.g., tools of the trade) and how business assets affect your case strategy.</p>
              </div>
            </>}
          </SectionCard>

          <ErrorBanner errors={errors}/>
        </div>
      );

      case 5: {
        const hasSpouseExp = data.filingType==="joint"||data.filingType==="individual-nonfiling-spouse";
        const hhSizeExp = parseInt(data.numDependents||0)+(hasSpouseExp?2:1);
        const irsTotal = ["food","housekeeping","apparel","personalCare","miscellaneous"].reduce((s,cat)=>s+getIrsStandard(cat,hhSizeExp),0);
        const housingStd = IRS_COVERED_STATES.includes(data.state) && data.county ? getHousingAllocations(data.state, data.county, hhSizeExp) : null;
        const numVehicles = (data.vehicles||[]).filter(v=>v.type).length||0;
        const transportStd = IRS_COVERED_STATES.includes(data.state) && data.county ? getTransportAllocations(data.state, data.county, numVehicles) : null;

        const autoFillIrsStandards = () => {
          const updates = {
            expFood: String(getIrsStandard("food", hhSizeExp)), expFoodOverride: "",
            expHouseholdSupplies: String(getIrsStandard("housekeeping", hhSizeExp)), expHouseholdSuppliesOverride: "",
            expClothing: String(getIrsStandard("apparel", hhSizeExp)), expClothingOverride: "",
            expPersonalCare: String(getIrsStandard("personalCare", hhSizeExp)), expPersonalCareOverride: "",
            expMisc: String(getIrsStandard("miscellaneous", hhSizeExp)), expMiscOverride: "",
          };
          if (housingStd) {
            updates.expElectricGas = String(housingStd.electricHeatGas); updates.expElectricGasOverride = "";
            updates.expWaterSewer = String(housingStd.waterSewerGarbage); updates.expWaterSewerOverride = "";
            updates.expPhone = String(housingStd.phoneInternetCable); updates.expPhoneOverride = "";
          }
          if (transportStd && !transportStd.isTransit) {
            updates.expGasFuel = String(transportStd.fuelMaintenance); updates.expGasFuelOverride = "";
            updates.expInsVehicle = String(transportStd.vehicleInsurance); updates.expInsVehicleOverride = "";
          }
          setData(p=>({...p, ...updates}));
        };

        return (
        <div>
          <div className="mb-4 p-4 bg-slate-800/60 border border-slate-600 rounded-xl">
            <p className="text-xs font-semibold text-slate-300 mb-1">Why expenses matter</p>
            <p className="text-xs text-slate-400 leading-relaxed">Your monthly expenses are filed on Official Form 106J (Schedule J) and are a required part of your bankruptcy case. They are also used in the Means Test to calculate your disposable income — the amount left over after subtracting allowed expenses from your income. The IRS publishes "National Standards" for certain categories (food, housekeeping, clothing, personal care, and miscellaneous) that are used as benchmarks. Please enter your actual monthly amounts as accurately as possible. Your attorney will review all figures.</p>
          </div>
          <div className="mb-4 bg-cyan-400/5 border border-cyan-400/20 rounded-xl px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-cyan-300 mb-1">IRS Standards Auto-Fill{housingStd ? ` — ${data.county} County, ${data.state}` : ""}</p>
                <p className="text-xs text-slate-400">Based on your <span className="text-white font-semibold">{hhSizeExp}-person household</span>, the 2025 IRS National Standards for Food, Housekeeping, Apparel, Personal Care, and Miscellaneous total <span className="text-cyan-400 font-semibold">${irsTotal.toLocaleString()}/mo</span>.
                  {housingStd && <span> Location-based standards are also available for utilities and transportation (housing bundle: <span className="text-cyan-400 font-semibold">${housingStd.bundle.toLocaleString()}/mo</span>).</span>}
                  {!housingStd && IRS_COVERED_STATES.includes(data.state) && !data.county && <span className="text-amber-400 ml-1">Enter your county to unlock location-based utility and transportation standards.</span>}
                </p>
              </div>
              <button
                type="button"
                onClick={autoFillIrsStandards}
                className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold bg-cyan-400/10 border border-cyan-400/40 text-cyan-400 hover:bg-cyan-400/20 hover:border-cyan-400 px-3 py-2 rounded-lg transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                Auto-fill all
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-400 mb-4 p-3 bg-slate-800/60 border border-slate-700 rounded-xl">
            All fields are required — enter <span className="text-white font-semibold">$0.00</span> for any that do not apply.
          </p>
          <SectionCard title="Housing — Primary Residence" icon="🏠">
            {data.realPropMonthlyPayment && data.isOccupiedPrimary==="yes" ? (
              <div className="mb-4">
                <label className="block text-xs font-semibold uppercase tracking-widest text-amber-400 mb-1">Monthly Mortgage Payment</label>
                <div className="flex items-center justify-between w-full bg-slate-700/60 border border-green-500/40 rounded-lg px-4 py-3">
                  <span className="text-green-400 font-bold">${parseFloat(data.realPropMonthlyPayment||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}/mo</span>
                  <span className="text-slate-400 text-xs">auto-filled from Real Property</span>
                </div>
              </div>
            ) : data.rentAtResidence && data.isOccupiedPrimary==="no" ? (
              <div className="mb-4">
                <label className="block text-xs font-semibold uppercase tracking-widest text-amber-400 mb-1">Monthly Rent Payment</label>
                <div className="flex items-center justify-between w-full bg-slate-700/60 border border-green-500/40 rounded-lg px-4 py-3">
                  <span className="text-green-400 font-bold">${parseFloat(data.rentAtResidence||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}/mo</span>
                  <span className="text-slate-400 text-xs">auto-filled from Property tab</span>
                </div>
              </div>
            ) : data.payRentAtResidence==="no" ? (
              <div className="mb-4">
                <div className="flex items-center gap-2 w-full bg-slate-700/60 border border-slate-600 rounded-lg px-4 py-3">
                  <span className="text-slate-400 text-sm">No rent or mortgage payment — confirmed in Property tab</span>
                </div>
              </div>
            ) : (
              <ExpenseField label="Monthly Rent or Mortgage Payment" error={e("expRentMortgage")} value={data.expRentMortgage} onChange={v=>u("expRentMortgage",v)}/>
            )}
            {data.hasLiens==="yes" && (data.liens||[]).filter(l=>parseFloat(l.monthlyPayment)>0).length>0 && (
              <div className="mb-4">
                <label className="block text-xs font-semibold uppercase tracking-widest text-amber-400 mb-2">Additional Lien Payments</label>
                {(data.liens||[]).filter(l=>parseFloat(l.monthlyPayment)>0).map((lien,i)=>(
                  <div key={lien.id||i} className="flex items-center justify-between bg-slate-700/60 border border-green-500/40 rounded-lg px-4 py-3 mb-2">
                    <div>
                      <p className="text-sm font-semibold text-green-400">${parseFloat(lien.monthlyPayment).toLocaleString()}/mo</p>
                      <p className="text-xs text-slate-400">{lien.lienType||"Lien"}{lien.lienHolder ? ` — ${lien.lienHolder}` : ""}</p>
                    </div>
                    <span className="text-xs text-slate-500">from Property tab</span>
                  </div>
                ))}
              </div>
            )}
            <Field label="Is this a mortgage or rent payment?" hint="This determines whether we ask about taxes, insurance, and payment status" error={e("mortgageIncludesInsurance")}>
              <RadioGroup name="mortgPITI" current={data.mortgageIncludesInsurance} onChange={v=>{
                u("mortgageIncludesInsurance",v);
                if (v==="renter") { u("expPropTax","0"); u("expHoa","0"); u("expHomeMaintenance","0"); }
                if (v==="both"||v==="taxonly") { u("expPropTax","0"); }
                if (v==="both"||v==="insonly") { u("expInsHome","0"); }
              }} error={e("mortgageIncludesInsurance")}
                options={[
                  {value:"both", label:"Mortgage — includes both taxes & insurance (full PITI)"},
                  {value:"taxonly", label:"Mortgage — taxes included, insurance paid separately"},
                  {value:"insonly", label:"Mortgage — insurance included, taxes paid separately"},
                  {value:"neither", label:"Mortgage — I pay taxes and insurance separately"},
                  {value:"renter", label:"Rent — I am renting my residence"},
                ]}/>
            </Field>
            {data.mortgageIncludesInsurance && data.mortgageIncludesInsurance!=="renter" && (
              <Field label="Are you current on your mortgage?" error={e("mortgageCurrent")}>
                <RadioGroup name="mortgCurr" current={data.mortgageCurrent} onChange={v=>u("mortgageCurrent",v)} error={e("mortgageCurrent")}
                  options={[{value:"yes",label:"Yes — current"},{value:"no",label:"No — behind on payments"}]}/>
              </Field>
            )}
            {data.mortgageCurrent==="no" && (
              <Field label="Total Mortgage Arrears" error={e("mortgageArrears")}>
                <Input type="number" value={data.mortgageArrears} onChange={v=>u("mortgageArrears",v)} placeholder="Enter amount" hasError={!!e("mortgageArrears")}/>
              </Field>
            )}
            {(data.mortgageIncludesInsurance==="insonly"||data.mortgageIncludesInsurance==="neither") && (
              <ExpenseField label="Monthly Property Tax" error={e("expPropTax")} value={data.expPropTax} onChange={v=>u("expPropTax",v)}/>
            )}
            {data.mortgageIncludesInsurance!=="renter" && (
              <>
                <ExpenseField label="HOA / Condo Fees" error={e("expHoa")} value={data.expHoa} onChange={v=>u("expHoa",v)}/>
                <ExpenseField label="Home Maintenance & Repairs" error={e("expHomeMaintenance")} value={data.expHomeMaintenance} onChange={v=>u("expHomeMaintenance",v)}/>
              </>
            )}
            {data.realPropType==="Mobile Home" && data.payLotSpaceRent==="yes" && (
              <div className="mb-4">
                <label className="block text-xs font-semibold uppercase tracking-widest text-amber-400 mb-1">Monthly Lot / Space Rent</label>
                <div className="flex items-center justify-between w-full bg-slate-700/60 border border-green-500/40 rounded-lg px-4 py-3">
                  <span className="text-green-400 font-bold">${parseFloat(data.expLotSpaceRent||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}/mo</span>
                  <span className="text-slate-400 text-xs">auto-filled from Real Property</span>
                </div>
              </div>
            )}
          </SectionCard>
          <SectionCard title="Utilities" icon="💡">
            <IrsExpenseField label="Electricity & Gas / Heat" category={null} hhSize={hhSizeExp} value={data.expElectricGas} onChange={v=>u("expElectricGas",v)} overrideReason={data.expElectricGasOverride} onOverrideReasonChange={v=>u("expElectricGasOverride",v)} error={e("expElectricGas")} customStandard={housingStd?.electricHeatGas} customLabel={housingStd ? `${data.county} County, ${data.state} (from IRS housing bundle)` : null}/>
            <IrsExpenseField label="Water, Sewer & Trash" category={null} hhSize={hhSizeExp} value={data.expWaterSewer} onChange={v=>u("expWaterSewer",v)} overrideReason={data.expWaterSewerOverride} onOverrideReasonChange={v=>u("expWaterSewerOverride",v)} error={e("expWaterSewer")} customStandard={housingStd?.waterSewerGarbage} customLabel={housingStd ? `${data.county} County, ${data.state} (from IRS housing bundle)` : null}/>
            <IrsExpenseField label="Phone / Internet / Cable" category={null} hhSize={hhSizeExp} value={data.expPhone} onChange={v=>u("expPhone",v)} overrideReason={data.expPhoneOverride} onOverrideReasonChange={v=>u("expPhoneOverride",v)} error={e("expPhone")} customStandard={housingStd?.phoneInternetCable} customLabel={housingStd ? `${data.county} County, ${data.state} — bundles phone, internet, cable (from IRS housing bundle)` : null}/>
            <ExpenseField label="Internet / Cable / Streaming (if not included above)" error={e("expInternet")} value={data.expInternet} onChange={v=>u("expInternet",v)}/>
          </SectionCard>
          <SectionCard title="Food & Household" icon="🛒">
            <IrsExpenseField label="Food & Groceries" category="food" hhSize={hhSizeExp} value={data.expFood} onChange={v=>u("expFood",v)} overrideReason={data.expFoodOverride} onOverrideReasonChange={v=>u("expFoodOverride",v)} error={e("expFood")}/>
            <IrsExpenseField label="Household Supplies" category="housekeeping" hhSize={hhSizeExp} value={data.expHouseholdSupplies} onChange={v=>u("expHouseholdSupplies",v)} overrideReason={data.expHouseholdSuppliesOverride} onOverrideReasonChange={v=>u("expHouseholdSuppliesOverride",v)} error={e("expHouseholdSupplies")}/>
          </SectionCard>
          <SectionCard title="Clothing & Personal Care" icon="👔">
            <IrsExpenseField label="Clothing & Apparel" category="apparel" hhSize={hhSizeExp} value={data.expClothing} onChange={v=>u("expClothing",v)} overrideReason={data.expClothingOverride} onOverrideReasonChange={v=>u("expClothingOverride",v)} error={e("expClothing")}/>
            <IrsExpenseField label="Personal Care Products & Services" category="personalCare" hhSize={hhSizeExp} value={data.expPersonalCare} onChange={v=>u("expPersonalCare",v)} overrideReason={data.expPersonalCareOverride} onOverrideReasonChange={v=>u("expPersonalCareOverride",v)} error={e("expPersonalCare")}/>
          </SectionCard>
          <SectionCard title="Miscellaneous" icon="📦">
            <IrsExpenseField label="Miscellaneous Living Expenses" category="miscellaneous" hhSize={hhSizeExp} value={data.expMisc} onChange={v=>u("expMisc",v)} overrideReason={data.expMiscOverride} onOverrideReasonChange={v=>u("expMiscOverride",v)} error={e("expMisc")}/>
          </SectionCard>
          <SectionCard title="Transportation" icon="🚗">
            {transportStd && !transportStd.isTransit && (
              <p className="text-xs text-slate-400 mb-3">IRS transport standard ({numVehicles} vehicle{numVehicles!==1?"s":""}, {data.county} County): <span className="text-cyan-400 font-semibold">${transportStd.bundle.toLocaleString()}/mo total</span></p>
            )}
            <IrsExpenseField label="Gas, Fuel & Vehicle Maintenance" category={null} hhSize={hhSizeExp} value={data.expGasFuel} onChange={v=>u("expGasFuel",v)} overrideReason={data.expGasFuelOverride} onOverrideReasonChange={v=>u("expGasFuelOverride",v)} error={e("expGasFuel")} customStandard={transportStd && !transportStd.isTransit ? transportStd.fuelMaintenance : null} customLabel={transportStd && !transportStd.isTransit ? `${data.county} County area — fuel, maintenance, repairs, registration, parking` : null}/>
            <ExpenseField label="Vehicle Maintenance & Repairs (if separate)" error={e("expCarMaintenance")} value={data.expCarMaintenance} onChange={v=>u("expCarMaintenance",v)}/>
            <ExpenseField label="Public Transit / Rideshare" error={e("expPublicTransit")} value={data.expPublicTransit} onChange={v=>u("expPublicTransit",v)}/>
            {financedVehicles().length===0 && (
              <div className="p-3 bg-slate-700/50 rounded-lg text-xs text-slate-400">No financed vehicles on file.</div>
            )}
            {financedVehicles().map((v,i)=>(
              <Field key={v.id} label={`${v.year} ${v.make} ${v.model} — Monthly Loan Payment`}>
                <div className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-amber-400 font-semibold text-sm">
                  ${(parseFloat(v.monthlyPayment)||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}/mo
                </div>
              </Field>
            ))}
          </SectionCard>
          <SectionCard title="Medical & Dental" icon="🏥">
            <ExpenseField label="Out-of-Pocket Medical & Dental" hint="Co-pays, prescriptions, not reimbursed" error={e("expMedical")} value={data.expMedical} onChange={v=>u("expMedical",v)}/>
          </SectionCard>
          <SectionCard title="Insurance" icon="🛡️">
            <ExpenseField label="Health Insurance (not deducted from wages)" error={e("expInsHealth")} value={data.expInsHealth} onChange={v=>u("expInsHealth",v)}/>
            <ExpenseField label="Life Insurance" error={e("expInsLife")} value={data.expInsLife} onChange={v=>u("expInsLife",v)}/>
            <IrsExpenseField label="Vehicle Insurance" category={null} hhSize={hhSizeExp} value={data.expInsVehicle} onChange={v=>u("expInsVehicle",v)} overrideReason={data.expInsVehicleOverride} onOverrideReasonChange={v=>u("expInsVehicleOverride",v)} error={e("expInsVehicle")} customStandard={transportStd && !transportStd.isTransit ? transportStd.vehicleInsurance : null} customLabel={transportStd && !transportStd.isTransit ? `${data.county} County area (from IRS transportation bundle)` : null}/>
            {(data.mortgageIncludesInsurance==="neither"||data.mortgageIncludesInsurance==="taxonly"||data.mortgageIncludesInsurance===""||data.mortgageIncludesInsurance==="renter") && (
              <ExpenseField label={data.mortgageIncludesInsurance==="renter"?"Renter's Insurance":"Homeowner's Insurance (not escrowed)"} error={e("expInsHome")} value={data.expInsHome} onChange={v=>u("expInsHome",v)}/>
            )}
            {(data.mortgageIncludesInsurance==="both"||data.mortgageIncludesInsurance==="insonly") && (
              <p className="text-xs text-green-400 mb-3">✅ Homeowner's insurance included in escrowed mortgage payment.</p>
            )}
            <ExpenseField label="Disability Insurance (not deducted from wages)" error={e("expInsDisability")} value={data.expInsDisability} onChange={v=>u("expInsDisability",v)}/>
            <ExpenseField label="Other Insurance" error={e("expInsOther")} value={data.expInsOther} onChange={v=>u("expInsOther",v)}/>
          </SectionCard>
          <SectionCard title="Children & Family" icon="👨‍👩‍👧">
            <ExpenseField label="Childcare" error={e("expChildcare")} value={data.expChildcare} onChange={v=>u("expChildcare",v)}/>
            <ExpenseField label="Children's Education" error={e("expChildEducation")} value={data.expChildEducation} onChange={v=>u("expChildEducation",v)}/>
            <ExpenseField label="Ongoing Child Support Paid (monthly — paid outside any plan)" error={e("expAlimonyPaid")} value={data.expAlimonyPaid} onChange={v=>u("expAlimonyPaid",v)}/>
            <ExpenseField label="Ongoing Alimony / Spousal Support Paid (monthly — paid outside any plan)" error={e("expSupportOthers")} value={data.expSupportOthers} onChange={v=>u("expSupportOthers",v)}/>
          </SectionCard>
          <SectionCard title="Other Monthly Expenses" icon="📋">
            <ExpenseField label="Recreation & Entertainment" error={e("expRecreation")} value={data.expRecreation} onChange={v=>u("expRecreation",v)}/>
            <ExpenseField label="Charitable Contributions" error={e("expCharitable")} value={data.expCharitable} onChange={v=>u("expCharitable",v)}/>
            <ExpenseField label="Additional Tax Payments" error={e("expAddlTaxes")} value={data.expAddlTaxes} onChange={v=>u("expAddlTaxes",v)}/>
            <ExpenseField label="Government Fines, Court Fees & Restitution" error={e("expGovFines")} value={data.expGovFines} onChange={v=>u("expGovFines",v)}/>
            {(parseFloat(data.expGovFines)||0) > 0 && (
              <div className="ml-0 mb-3 bg-amber-400/5 border border-amber-400/20 rounded-xl p-4">
                <p className="text-xs font-semibold text-amber-400 mb-2">Do any of these fines or restitution obligations relate to a DUI or alcohol/drug-related driving offense?</p>
                <div className="flex gap-2 mb-2">
                  {[{v:"yes",label:"Yes"},{v:"no",label:"No"},{v:"unsure",label:"Not sure"}].map(opt=>(
                    <button key={opt.v} type="button"
                      onClick={()=>u("finesInvolveDui",opt.v)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${data.finesInvolveDui===opt.v?"bg-amber-400/15 border-amber-400 text-amber-400":"bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500"}`}
                    >{opt.label}</button>
                  ))}
                </div>
                {(data.finesInvolveDui==="yes"||data.finesInvolveDui==="unsure") && (
                  <div className="mt-2 p-3 bg-slate-900 border border-slate-700 rounded-xl space-y-2">
                    <p className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                      General Information — Not Legal Advice
                    </p>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Under federal bankruptcy law (11 U.S.C. § 523(a)(9)), debts arising from personal injury or death caused by the debtor's operation of a vehicle while unlawfully intoxicated are generally <strong className="text-slate-300">not dischargeable</strong> in bankruptcy. This includes fines and restitution connected to DUI-related incidents.
                    </p>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Whether a specific obligation falls under this exception depends on the individual facts and circumstances of your case. A licensed bankruptcy attorney will review this as part of your case evaluation. This information is provided for general awareness only and does not constitute legal advice.
                    </p>
                    <button type="button" onClick={()=>u("finesDuiInfo",!data.finesDuiInfo)} className="text-xs text-slate-500 underline underline-offset-2 hover:text-slate-300 transition-colors">
                      {data.finesDuiInfo?"Hide":"I understand — this is general information only"}
                    </button>
                  </div>
                )}
              </div>
            )}
            <ExpenseField label="All Other Expenses" error={e("expOther")} value={data.expOther} onChange={v=>u("expOther",v)}/>
          </SectionCard>
          <div className="bg-slate-900 border border-amber-400/30 rounded-2xl p-4 mb-4">
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Total Monthly Expenses (Schedule J)</p>
            <p className="text-3xl font-serif font-bold text-amber-400">${totalExpenses().toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
          </div>
          <ErrorBanner errors={errors}/>
        </div>
        );
      }

      case 6: return (
        <div>
          <SectionCard title="Business Debts — Schedule E/F" icon="🏢">
            {data.hasBusinessDebt !== "yes" && (
              <button onClick={()=>u("hasBusinessDebt","no")}
                className={`w-full flex items-center justify-center gap-3 px-4 py-4 rounded-xl border-2 font-bold text-sm transition-all mb-4 ${data.hasBusinessDebt==="no"?"bg-green-500/20 border-green-500 text-green-300":"bg-slate-800/60 border-dashed border-slate-500 text-slate-300 hover:border-amber-400 hover:text-amber-400"}`}>
                {data.hasBusinessDebt==="no" ? <>✓ Acknowledged — I have no business debts</> : <>🏢 I do not have any business debts — click to confirm</>}
              </button>
            )}
            {data.hasBusinessDebt==="no" && (
              <button onClick={()=>u("hasBusinessDebt","")} className="w-full text-xs text-slate-400 hover:text-amber-400 underline mb-2 text-center">I do have business debts — click to enter them</button>
            )}
            {data.hasBusinessDebt !== "no" && (
              <>
                {data.hasBusinessDebt !== "yes" && (
                  <button onClick={()=>u("hasBusinessDebt","yes")} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-amber-400/50 text-amber-400 hover:bg-amber-400/10 font-semibold text-sm transition-all mb-4">
                    <span>+</span> I have business debts — enter them below
                  </button>
                )}
                {data.hasBusinessDebt==="yes" && (
                  <>
                    {[
                      {label:"SBA EIDL Loan", field:"sbaEidlDebt", noField:"noSbaEidlDebt"},
                      {label:"SBA 7(a) Loan", field:"sba7aDebt", noField:"noSba7aDebt"},
                      {label:"Business Equipment Loans", field:"businessEquipmentDebt", noField:"noBusinessEquipmentDebt"},
                      {label:"Business Line of Credit", field:"businessLineDebt", noField:"noBusinessLineDebt"},
                      {label:"Supply / Vendor Debt", field:"supplyVendorDebt", noField:"noSupplyVendorDebt"},
                      {label:"Business Credit Cards", field:"businessCreditCardDebt", noField:"noBusinessCreditCardDebt"},
                      {label:"Commercial Mortgage", field:"businessMortgageDebt", noField:"noBusinessMortgageDebt"},
                      {label:"Other Business Debt", field:"otherBusinessDebt", noField:"noOtherBusinessDebt"},
                    ].map(({label, field, noField})=>(
                      <div key={field} className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</label>
                          <button
                            type="button"
                            onClick={()=>{
                              const next = !data[noField];
                              u(noField, next);
                              if (next) u(field, "");
                            }}
                            className={`text-xs px-3 py-1 rounded-lg border font-semibold transition-all ${data[noField]?"bg-green-500/15 border-green-500/50 text-green-400":"border-slate-600 text-slate-500 hover:border-slate-400 hover:text-slate-300"}`}
                          >
                            {data[noField] ? "✓ N/A" : "I do not have this"}
                          </button>
                        </div>
                        {!data[noField] && (
                          <Input type="number" value={data[field]} onChange={v=>u(field,v)} placeholder="Enter balance"/>
                        )}
                        {data[noField] && (
                          <div className="px-3 py-2 bg-slate-800/40 border border-slate-700 rounded-lg text-xs text-slate-500 italic">Not applicable</div>
                        )}
                      </div>
                    ))}
                    {totalBusinessDebt()>0 && (
                      <div className="mt-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <p className="text-xs text-slate-400">Total Business Debt:</p>
                        <p className="text-xl font-serif text-blue-400 font-bold">${totalBusinessDebt().toLocaleString("en-US",{maximumFractionDigits:0})}</p>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </SectionCard>

          <SectionCard title="Secured Consumer Debts — Schedule D" icon="🔒">
            {data.hasMortgage !== "yes" && (
              <button onClick={()=>{u("hasMortgage","no"); u("securedDebt","0");}}
                className={`w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border-2 font-bold text-sm transition-all mb-4 ${data.hasMortgage==="no"?"bg-green-500/20 border-green-500 text-green-300":"bg-slate-800/60 border-dashed border-slate-500 text-slate-300 hover:border-amber-400 hover:text-amber-400"}`}>
                {data.hasMortgage==="no" ? <>✓ Acknowledged — I do not have a mortgage</> : <>🏠 I do not have a mortgage — click to confirm</>}
              </button>
            )}
            {data.hasMortgage==="no" && (
              <button onClick={()=>{u("hasMortgage",""); u("securedDebt","");}} className="w-full text-xs text-slate-400 hover:text-amber-400 underline mb-3 text-center">I do have a mortgage — click to enter it</button>
            )}
            {data.hasMortgage !== "no" && data.hasMortgage !== "yes" && (
              <button onClick={()=>u("hasMortgage","yes")} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-amber-400/50 text-amber-400 hover:bg-amber-400/10 font-semibold text-sm transition-all mb-4">
                <span>+</span> I have a mortgage — enter balance below
              </button>
            )}
            {data.hasMortgage==="yes" && (
              <Field label="Total Mortgage Balance" error={e("securedDebt")}>
                {data.mortgageBalance && data.mortgageBalance !== "" ? (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-slate-800/60 border border-slate-600 rounded-xl px-4 py-3 flex items-center justify-between">
                      <span className="text-white font-semibold">${parseFloat(data.mortgageBalance).toLocaleString("en-US",{maximumFractionDigits:0})}</span>
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        From property info
                      </span>
                    </div>
                  </div>
                ) : (
                  <Input type="number" value={data.securedDebt} onChange={v=>u("securedDebt",v)} placeholder="Enter mortgage balance" hasError={!!e("securedDebt")}/>
                )}
              </Field>
            )}
          </SectionCard>

          <SectionCard title="Unsecured Consumer Debts — Schedule E/F" icon="💳">
            <p className="text-xs text-slate-400 mb-4">Enter the approximate balance for each debt type, or tap <strong className="text-slate-300">I don't have this</strong> if a category does not apply to you.</p>

            {[
              {key:"creditCardDebt", noKey:"noCreditCardDebt", label:"Credit Card Debt", hint:null},
              {key:"medicalDebt", noKey:"noMedicalDebt", label:"Medical Bills", hint:null},
              {key:"studentLoanDebt", noKey:"noStudentLoanDebt", label:"Student Loans", hint:null},
              {key:"taxDebt", noKey:"noTaxDebt", label:"Tax Debt (IRS / State — personal income taxes)", hint:null},
              {key:"personalLoanDebt", noKey:"noPersonalLoanDebt", label:"Personal / Payday Loans", hint:null},
              {key:"judgmentDebt", noKey:"noJudgmentDebt", label:"Judgments Against You", hint:null},
              {key:"otherUnsecured", noKey:"noOtherUnsecured", label:"All Other Unsecured Consumer Debt", hint:null},
            ].map(({key, noKey, label}) => (
              <div key={key} className="mb-3">
                {data[noKey] ? (
                  <div className="flex items-center justify-between bg-green-500/8 border border-green-500/20 rounded-xl px-4 py-2.5">
                    <span className="text-green-400 text-xs font-semibold flex items-center gap-1.5">
                      <span className="text-green-400">✓</span> {label} — not applicable
                    </span>
                    <button type="button" onClick={()=>{u(noKey,false); u(key,"");}} className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2 transition-colors">
                      I do have this
                    </button>
                  </div>
                ) : (
                  <Field label={label} error={e(key)}>
                    <div className="flex gap-2 items-start">
                      <div className="flex-1">
                        <Input type="number" value={data[key]} onChange={v=>u(key,v)} placeholder="Enter amount" hasError={!!e(key)}/>
                      </div>
                      <button type="button"
                        onClick={()=>{u(noKey,true); u(key,"0");}}
                        className="flex-shrink-0 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-slate-500 text-slate-400 hover:text-slate-200 px-3 py-2.5 rounded-xl transition-all whitespace-nowrap"
                      >
                        I don't have this
                      </button>
                    </div>
                  </Field>
                )}
              </div>
            ))}

            {/* Child Support — current status & arrears */}
            <div className="mb-3">
              <p className="text-xs font-semibold text-slate-300 mb-2">Child Support</p>
              <Field label="Are you current or behind on child support payments?" error={e("childSupportCurrent")}>
                <div className="flex gap-2">
                  {[{v:"current",label:"Current"},{v:"behind",label:"Behind / Have Arrears"},{v:"none",label:"No Obligation"}].map(opt=>(
                    <button key={opt.v} type="button"
                      onClick={()=>{u("childSupportCurrent",opt.v); if(opt.v!=="behind"){u("childSupportArrears",""); u("noChildSupportArrears",false);}}}
                      className={`flex-1 text-xs py-2.5 rounded-xl border font-medium transition-all ${data.childSupportCurrent===opt.v ? "bg-blue-600 border-blue-500 text-white" : "bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200"}`}
                    >{opt.label}</button>
                  ))}
                </div>
              </Field>
              {data.childSupportCurrent==="behind" && (
                <div className="mt-2">
                  {data.noChildSupportArrears ? (
                    <div className="flex items-center justify-between bg-green-500/8 border border-green-500/20 rounded-xl px-4 py-2.5">
                      <span className="text-green-400 text-xs font-semibold flex items-center gap-1.5"><span className="text-green-400">✓</span> Child Support Arrears — not applicable</span>
                      <button type="button" onClick={()=>{u("noChildSupportArrears",false); u("childSupportArrears","");}} className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2 transition-colors">I do have this</button>
                    </div>
                  ) : (
                    <Field label="Child Support Arrears (total past-due amount)" error={e("childSupportArrears")}>
                      <div className="flex gap-2 items-start">
                        <div className="flex-1">
                          <Input type="number" value={data.childSupportArrears} onChange={v=>u("childSupportArrears",v)} placeholder="Enter arrears amount" hasError={!!e("childSupportArrears")}/>
                        </div>
                        <button type="button" onClick={()=>{u("noChildSupportArrears",true); u("childSupportArrears","0");}} className="flex-shrink-0 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-slate-500 text-slate-400 hover:text-slate-200 px-3 py-2.5 rounded-xl transition-all whitespace-nowrap">I don't have this</button>
                      </div>
                      <p className="text-[11px] text-blue-400/80 mt-1.5">Arrears will be listed as a priority debt paid through your Ch. 13 plan. Your ongoing monthly payment continues outside the plan.</p>
                    </Field>
                  )}
                </div>
              )}
            </div>

            {/* Alimony — current status & arrears */}
            <div className="mb-3">
              <p className="text-xs font-semibold text-slate-300 mb-2">Alimony / Spousal Support</p>
              <Field label="Are you current or behind on alimony / spousal support payments?" error={e("alimonyCurrent")}>
                <div className="flex gap-2">
                  {[{v:"current",label:"Current"},{v:"behind",label:"Behind / Have Arrears"},{v:"none",label:"No Obligation"}].map(opt=>(
                    <button key={opt.v} type="button"
                      onClick={()=>{u("alimonyCurrent",opt.v); if(opt.v!=="behind"){u("alimonyArrears",""); u("noAlimonyArrears",false);}}}
                      className={`flex-1 text-xs py-2.5 rounded-xl border font-medium transition-all ${data.alimonyCurrent===opt.v ? "bg-blue-600 border-blue-500 text-white" : "bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200"}`}
                    >{opt.label}</button>
                  ))}
                </div>
              </Field>
              {data.alimonyCurrent==="behind" && (
                <div className="mt-2">
                  {data.noAlimonyArrears ? (
                    <div className="flex items-center justify-between bg-green-500/8 border border-green-500/20 rounded-xl px-4 py-2.5">
                      <span className="text-green-400 text-xs font-semibold flex items-center gap-1.5"><span className="text-green-400">✓</span> Alimony Arrears — not applicable</span>
                      <button type="button" onClick={()=>{u("noAlimonyArrears",false); u("alimonyArrears","");}} className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2 transition-colors">I do have this</button>
                    </div>
                  ) : (
                    <Field label="Alimony Arrears (total past-due amount)" error={e("alimonyArrears")}>
                      <div className="flex gap-2 items-start">
                        <div className="flex-1">
                          <Input type="number" value={data.alimonyArrears} onChange={v=>u("alimonyArrears",v)} placeholder="Enter arrears amount" hasError={!!e("alimonyArrears")}/>
                        </div>
                        <button type="button" onClick={()=>{u("noAlimonyArrears",true); u("alimonyArrears","0");}} className="flex-shrink-0 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-slate-500 text-slate-400 hover:text-slate-200 px-3 py-2.5 rounded-xl transition-all whitespace-nowrap">I don't have this</button>
                      </div>
                      <p className="text-[11px] text-blue-400/80 mt-1.5">Arrears will be listed as a priority debt paid through your Ch. 13 plan. Your ongoing monthly payment continues outside the plan.</p>
                    </Field>
                  )}
                </div>
              )}
            </div>
          </SectionCard>

          {(totalConsumerDebt()>0 || totalBusinessDebt()>0) && (
            <SectionCard title="Debt Summary" icon="⚖️">
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 bg-slate-700/50 rounded-lg text-center">
                  <p className="text-xs text-slate-400 mb-1">Consumer Debt</p>
                  <p className="text-lg font-serif font-bold text-white">${totalConsumerDebt().toLocaleString("en-US",{maximumFractionDigits:0})}</p>
                  <p className="text-xs text-slate-500">{100 - nonConsumerPct()}% of total</p>
                </div>
                <div className="p-3 bg-slate-700/50 rounded-lg text-center">
                  <p className="text-xs text-slate-400 mb-1">Business Debt</p>
                  <p className="text-lg font-serif font-bold text-blue-400">${totalBusinessDebt().toLocaleString("en-US",{maximumFractionDigits:0})}</p>
                  <p className="text-xs text-slate-500">{nonConsumerPct()}% of total</p>
                </div>
              </div>
              <div className="p-3 bg-slate-700/50 rounded-lg flex items-center justify-between">
                <p className="text-xs text-slate-400">Total Debt:</p>
                <p className="text-xl font-serif text-amber-400 font-bold">${totalDebt().toLocaleString("en-US",{maximumFractionDigits:0})}</p>
              </div>
              {meansTestExempt()===true && (
                <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs text-blue-300">
                  ℹ️ Business debt represents {nonConsumerPct()}% of total debt — an attorney will review how this affects your options under 11 U.S.C. § 707(b)(1).
                </div>
              )}
            </SectionCard>
          )}
          <ErrorBanner errors={errors}/>
        </div>
      );

      case 7: return (
        <div>
          <SectionCard title="Prior Bankruptcy Filings — Last 8 Years" icon="📋">
            <Field label="Have you filed for bankruptcy in the last 8 years?" error={e("priorBankruptcy")}>
              <RadioGroup name="priorBk" current={data.priorBankruptcy} onChange={v=>u("priorBankruptcy",v)} error={e("priorBankruptcy")}
                options={[{value:"yes",label:"Yes"},{value:"no",label:"No — never filed or filed more than 8 years ago"}]}/>
            </Field>
            {data.priorBankruptcy==="yes" && <>
              {data.priorBankruptcies.map((bk,i)=>(
                <div key={bk.id} className="bg-slate-900/60 border border-slate-600 rounded-xl p-4 mb-3">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Prior Case {i+1}</p>
                    {data.priorBankruptcies.length>1 && <button onClick={()=>remArr("priorBankruptcies",i)} className="text-xs text-red-400 border border-red-400/30 px-2 py-1 rounded-lg">Remove</button>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Chapter Filed" error={errors[`bk_${i}_chapter`]}>
                      <Select value={bk.chapter} onChange={v=>uArr("priorBankruptcies",i,"chapter",v)} hasError={!!errors[`bk_${i}_chapter`]}
                        options={["Chapter 7","Chapter 11","Chapter 12","Chapter 13"]} placeholder="Select chapter..."/>
                    </Field>
                    <Field label="Year Filed" error={errors[`bk_${i}_yearFiled`]}>
                      <Input value={bk.yearFiled} onChange={v=>uArr("priorBankruptcies",i,"yearFiled",v)} placeholder="e.g. 2020" hasError={!!errors[`bk_${i}_yearFiled`]}/>
                    </Field>
                  </div>
                  <Field label="Case Disposition" error={errors[`bk_${i}_disposition`]}>
                    <Select value={bk.disposition} onChange={v=>uArr("priorBankruptcies",i,"disposition",v)} hasError={!!errors[`bk_${i}_disposition`]}
                      options={[
                        {value:"discharged", label:"Discharged — debts were discharged"},
                        {value:"dismissed", label:"Dismissed — case was dismissed"},
                        {value:"closed_no_discharge", label:"Closed without discharge"},
                        {value:"pending", label:"Still pending / not yet closed"},
                      ]} placeholder="Select outcome..."/>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Case Number (optional)"><Input value={bk.caseNumber} onChange={v=>uArr("priorBankruptcies",i,"caseNumber",v)} placeholder="Optional"/></Field>
                    <Field label="Filing District (optional)"><Input value={bk.district} onChange={v=>uArr("priorBankruptcies",i,"district",v)} placeholder="Optional"/></Field>
                  </div>
                </div>
              ))}
              <button onClick={()=>addArr("priorBankruptcies",emptyPriorBk)} className="w-full border border-dashed border-amber-400/40 hover:border-amber-400 text-amber-400 text-sm font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                <span className="text-lg">+</span> Add Another Prior Case
              </button>
            </>}
          </SectionCard>

          <SectionCard title="Property Transfers — SOFA § 18" icon="🔄">
            <Field label="Have you transferred, sold, or gifted any property in the last 2 years?" error={e("transferredProperty")}>
              <RadioGroup name="transfer" current={data.transferredProperty} onChange={v=>u("transferredProperty",v)} error={e("transferredProperty")}
                options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
            </Field>
            {data.transferredProperty==="yes" && <>
              {data.transfers.map((t,i)=>(
                <div key={t.id} className="bg-slate-900/60 border border-slate-600 rounded-xl p-4 mb-3">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Transfer {i+1}</p>
                    {data.transfers.length>1 && <button onClick={()=>remArr("transfers",i)} className="text-xs text-red-400 border border-red-400/30 px-2 py-1 rounded-lg">Remove</button>}
                  </div>
                  <Field label="Description of Property" error={errors[`tr_${i}_description`]}><Input value={t.description} onChange={v=>uArr("transfers",i,"description",v)} placeholder="e.g. 2018 Ford F-150, cash" hasError={!!errors[`tr_${i}_description`]}/></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Transferred To" error={errors[`tr_${i}_recipient`]}><Input value={t.recipient} onChange={v=>uArr("transfers",i,"recipient",v)} placeholder="Name of recipient" hasError={!!errors[`tr_${i}_recipient`]}/></Field>
                    <Field label="Relationship"><Select value={t.relationship} onChange={v=>uArr("transfers",i,"relationship",v)} options={["Spouse","Parent","Child","Sibling","Other Family","Friend","Business Partner","Unrelated Third Party","Other"]} placeholder="Select..."/></Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Fair Market Value at Time of Transfer" error={errors[`tr_${i}_fairMarketValue`]}><Input type="number" value={t.fairMarketValue} onChange={v=>uArr("transfers",i,"fairMarketValue",v)} placeholder="What it was worth" hasError={!!errors[`tr_${i}_fairMarketValue`]}/></Field>
                    <Field label="Amount Actually Received" error={errors[`tr_${i}_amount`]}><Input type="number" value={t.amount} onChange={v=>uArr("transfers",i,"amount",v)} placeholder="0 if gifted" hasError={!!errors[`tr_${i}_amount`]}/></Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Date" error={errors[`tr_${i}_date`]}><Input value={t.date} onChange={v=>uArr("transfers",i,"date",v)} placeholder="MM/YYYY" hasError={!!errors[`tr_${i}_date`]}/></Field>
                    {t.fairMarketValue && t.amount && parseFloat(t.fairMarketValue)>0 && (
                      <Field label="Was this sold/transferred for less than its value?">
                        <RadioGroup name={`tr_${i}_soldForLess`} current={t.soldForLess}
                          onChange={v=>uArr("transfers",i,"soldForLess",v)}
                          options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
                      </Field>
                    )}
                  </div>
                  {(t.soldForLess==="yes" || (t.fairMarketValue && t.amount && parseFloat(t.fairMarketValue)>0 && parseFloat(t.amount)<parseFloat(t.fairMarketValue))) && (
                    <div className="mt-1 p-3 rounded-xl bg-red-500/10 border border-red-500/35 text-xs text-red-300 leading-relaxed">
                      <p className="font-bold mb-1">⚠ Attorney Review Required — Potential Fraudulent Transfer</p>
                      <p>A transfer made for <strong>less than reasonably equivalent value</strong> within 2 years before filing may be avoidable by the trustee under the <strong>Fraudulent Transfer Rule (11 U.S.C. § 548)</strong>. Your attorney must review this transfer carefully. <strong>Do not attempt to explain or justify this transfer to anyone without legal counsel.</strong></p>
                    </div>
                  )}
                </div>
              ))}
              <button onClick={()=>addArr("transfers",emptyTransfer)} className="w-full border border-dashed border-amber-400/40 hover:border-amber-400 text-amber-400 text-sm font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                <span className="text-lg">+</span> Add Another Transfer
              </button>
            </>}
          </SectionCard>

          <SectionCard title="Preferential Payments — Regular Creditors (SOFA § 3)" icon="💸">
            <p className="text-xs text-slate-400 mb-3">Payments of <strong className="text-slate-300">$600 or more</strong> to regular creditors (banks, credit card companies, lenders) within the <strong className="text-amber-400">last 90 days</strong> may be recoverable by the trustee under § 547.</p>
            <Field label="Have you paid $600 or more to any regular creditor in the last 90 days?" error={e("preferentialPayments")}>
              <RadioGroup name="prefer" current={data.preferentialPayments} onChange={v=>u("preferentialPayments",v)} error={e("preferentialPayments")}
                options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
            </Field>
            {data.preferentialPayments==="yes" && <>
              {data.preferentialEntries.map((p,i)=>(
                <div key={p.id} className="bg-slate-900/60 border border-slate-600 rounded-xl p-4 mb-3">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Payment {i+1}</p>
                    {data.preferentialEntries.length>1 && <button onClick={()=>remArr("preferentialEntries",i)} className="text-xs text-red-400 border border-red-400/30 px-2 py-1 rounded-lg">Remove</button>}
                  </div>
                  <Field label="Payment Type" error={errors[`pf_${i}_type`]}>
                    <Select value={p.type} onChange={v=>uArr("preferentialEntries",i,"type",v)} hasError={!!errors[`pf_${i}_type`]}
                      options={[
                        {value:"mortgage_extra", label:"Extra / lump-sum mortgage payment"},
                        {value:"car_payoff", label:"Vehicle loan payoff"},
                        {value:"credit_card", label:"Large credit card payoff / paydown"},
                        {value:"tax_payment", label:"Tax payment"},
                        {value:"medical_bill", label:"Medical bill payment"},
                        {value:"other", label:"Other payment to regular creditor"},
                      ]} placeholder="Select payment type..."/>
                  </Field>
                  <Field label="Creditor / Payee Name" error={errors[`pf_${i}_creditor`]}><Input value={p.creditor} onChange={v=>uArr("preferentialEntries",i,"creditor",v)} placeholder="Name of creditor or lender" hasError={!!errors[`pf_${i}_creditor`]}/></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Amount Paid" error={errors[`pf_${i}_amount`]}><Input type="number" value={p.amount} onChange={v=>uArr("preferentialEntries",i,"amount",v)} placeholder="Enter amount" hasError={!!errors[`pf_${i}_amount`]}/></Field>
                    <Field label="Date of Payment" error={errors[`pf_${i}_date`]}><Input value={p.date} onChange={v=>uArr("preferentialEntries",i,"date",v)} placeholder="MM/YYYY" hasError={!!errors[`pf_${i}_date`]}/></Field>
                  </div>
                  {(()=>{
                    const days = daysSince(p.date);
                    if (days === null && p.date && p.date.length >= 4) return (
                      <div className="mt-1 p-2 rounded-xl bg-slate-800 border border-slate-600 text-xs text-slate-400">Enter date as MM/YYYY to validate the 90-day window.</div>
                    );
                    if (days !== null && days > 90) return (
                      <div className="mt-1 space-y-2">
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 leading-relaxed">
                          <p className="font-bold mb-1">This payment appears to be more than 90 days ago.</p>
                          <p>The 90-day preference window for regular creditors under § 547 may not apply. Please confirm: was this payment made <strong>within the last 90 days</strong> before your anticipated filing date?</p>
                        </div>
                        <Field label="Was this payment made within 90 days of your expected filing date?">
                          <RadioGroup name={`pf_${i}_dateConfirmed`} current={p.dateConfirmedRecent}
                            onChange={v=>uArr("preferentialEntries",i,"dateConfirmedRecent",v)}
                            options={[{value:"yes",label:"Yes, it was within 90 days"},{value:"no",label:"No, it was more than 90 days ago"}]}/>
                        </Field>
                        {p.dateConfirmedRecent==="no" && (
                          <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-600 text-xs text-slate-300 leading-relaxed">
                            If this payment was made more than 90 days before filing and the creditor is not an insider, it generally falls outside the preference recovery window. Your attorney will confirm whether it still needs to be listed.
                          </div>
                        )}
                      </div>
                    );
                    return null;
                  })()}
                </div>
              ))}
              <button onClick={()=>addArr("preferentialEntries",emptyPreferential)} className="w-full border border-dashed border-amber-400/40 hover:border-amber-400 text-amber-400 text-sm font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                <span className="text-lg">+</span> Add Another Payment
              </button>
            </>}
          </SectionCard>

          <SectionCard title="Preferential Payments — Insiders (SOFA § 3)" icon="👥">
            <p className="text-xs text-slate-400 mb-3">Payments to <strong className="text-slate-300">insiders</strong> (family members, friends, business partners, or anyone you have a close relationship with) within the <strong className="text-amber-400">last 12 months</strong> may be recoverable by the trustee under § 547, regardless of the amount.</p>
            <Field label="Have you paid any money to a family member, friend, or other insider in the last 12 months?" error={e("preferentialPaymentsInsider")}>
              <RadioGroup name="preferInsider" current={data.preferentialPaymentsInsider} onChange={v=>u("preferentialPaymentsInsider",v)} error={e("preferentialPaymentsInsider")}
                options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
            </Field>
            {data.preferentialPaymentsInsider==="yes" && <>
              {data.preferentialInsiderEntries.map((p,i)=>(
                <div key={p.id} className="bg-slate-900/60 border border-amber-400/20 rounded-xl p-4 mb-3">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">Insider Payment {i+1}</p>
                    {data.preferentialInsiderEntries.length>1 && <button onClick={()=>remArr("preferentialInsiderEntries",i)} className="text-xs text-red-400 border border-red-400/30 px-2 py-1 rounded-lg">Remove</button>}
                  </div>
                  <Field label="Name of Insider / Payee" error={errors[`pfi_${i}_creditor`]}><Input value={p.creditor} onChange={v=>uArr("preferentialInsiderEntries",i,"creditor",v)} placeholder="Full name of person or entity" hasError={!!errors[`pfi_${i}_creditor`]}/></Field>
                  <Field label="Relationship to You" error={errors[`pfi_${i}_relationship`]}><Input value={p.relationship} onChange={v=>uArr("preferentialInsiderEntries",i,"relationship",v)} placeholder="e.g. Mother, Business partner, Close friend" hasError={!!errors[`pfi_${i}_relationship`]}/></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Amount Paid" error={errors[`pfi_${i}_amount`]}><Input type="number" value={p.amount} onChange={v=>uArr("preferentialInsiderEntries",i,"amount",v)} placeholder="Enter amount" hasError={!!errors[`pfi_${i}_amount`]}/></Field>
                    <Field label="Date of Payment" error={errors[`pfi_${i}_date`]}><Input value={p.date} onChange={v=>uArr("preferentialInsiderEntries",i,"date",v)} placeholder="MM/YYYY" hasError={!!errors[`pfi_${i}_date`]}/></Field>
                  </div>
                  {(()=>{
                    const days = daysSince(p.date);
                    if (days === null && p.date && p.date.length >= 4) return (
                      <div className="mt-1 p-2 rounded-xl bg-slate-800 border border-slate-600 text-xs text-slate-400">Enter date as MM/YYYY to validate the 1-year insider window.</div>
                    );
                    if (days !== null && days > 365) return (
                      <div className="mt-1 space-y-2">
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 leading-relaxed">
                          <p className="font-bold mb-1">This payment appears to be more than 1 year ago.</p>
                          <p>Insider preference payments under § 547 only need to be listed if made <strong>within the 12 months before filing</strong>. If this payment was over a year ago, you may not need to list it. Please confirm.</p>
                        </div>
                        <Field label="Was this payment made within the last 12 months?">
                          <RadioGroup name={`pfi_${i}_dateConfirmed`} current={p.dateConfirmedRecent}
                            onChange={v=>uArr("preferentialInsiderEntries",i,"dateConfirmedRecent",v)}
                            options={[{value:"yes",label:"Yes, within the last 12 months"},{value:"no",label:"No, it was more than a year ago"}]}/>
                        </Field>
                        {p.dateConfirmedRecent==="no" && (
                          <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/25 text-xs text-green-300 leading-relaxed">
                            <p className="font-bold mb-1">You do not need to list this payment.</p>
                            <p>Payments to insiders made more than 12 months before the anticipated filing date fall outside the insider preference window. You can remove this entry or your attorney will disregard it during review.</p>
                            <button onClick={()=>{ if(data.preferentialInsiderEntries.length>1) remArr("preferentialInsiderEntries",i); else uArr("preferentialInsiderEntries",i,"dateIsOld","yes"); }}
                              className="mt-2 px-3 py-1.5 rounded-lg bg-green-500/20 border border-green-500/30 text-green-300 font-semibold hover:bg-green-500/30 transition-colors">
                              Remove This Entry
                            </button>
                          </div>
                        )}
                        {p.dateConfirmedRecent==="yes" && (
                          <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-600 text-xs text-slate-300">
                            Confirmed — this payment is within the 12-month window and will be listed for attorney review.
                          </div>
                        )}
                      </div>
                    );
                    if (days !== null && days <= 365) return (
                      <div className="mt-1 p-2 rounded-xl bg-green-500/10 border border-green-500/25 text-xs text-green-300">
                        Within the 12-month insider window — this payment will be reviewed.
                      </div>
                    );
                    return null;
                  })()}
                  {p.dateIsOld==="yes" && data.preferentialInsiderEntries.length===1 && (
                    <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-400 mt-1">
                      This entry is marked as outside the 1-year window and will be disregarded. You may add a new entry if needed.
                    </div>
                  )}
                </div>
              ))}
              <button onClick={()=>addArr("preferentialInsiderEntries",emptyPreferentialInsider)} className="w-full border border-dashed border-amber-400/40 hover:border-amber-400 text-amber-400 text-sm font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                <span className="text-lg">+</span> Add Another Insider Payment
              </button>
            </>}
          </SectionCard>

          <SectionCard title="Other Financial History — SOFA" icon="🔍">
            <Field label="Have you created or transferred assets into a trust in the last 10 years?" error={e("createdTrust")}>
              <RadioGroup name="createdTrust" current={data.createdTrust} onChange={v=>u("createdTrust",v)} error={e("createdTrust")} options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
              {data.createdTrust==="yes" && (
                <div className="mt-2 space-y-2">
                  <Input value={data.trustDetails} onChange={v=>u("trustDetails",v)} placeholder="Name of trust, date created, assets transferred, trustee name" hasError={!!e("trustDetails")}/>
                  {e("trustDetails") && <p className="text-xs text-red-400">⚠ {e("trustDetails")}</p>}
                  <div className="p-3 bg-slate-900 border border-slate-700 rounded-xl">
                    <p className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                      General Information — Not Legal Advice
                    </p>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Under federal bankruptcy law, trustees have the authority to review and potentially avoid certain transfers into trusts made within the 10 years prior to filing, particularly if the transfer was made to hinder, delay, or defraud creditors (11 U.S.C. § 548). This information must be disclosed on your bankruptcy schedules. A licensed bankruptcy attorney will evaluate how trust transfers may affect your case.
                    </p>
                  </div>
                </div>
              )}
            </Field>
            <Field label="Any lawsuits filed against you or pending?" error={e("pendingLawsuits")}>
              <RadioGroup name="lawsuit" current={data.pendingLawsuits} onChange={v=>u("pendingLawsuits",v)} error={e("pendingLawsuits")} options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
              {data.pendingLawsuits==="yes" && <div className="mt-2"><Input value={data.lawsuitDetails} onChange={v=>u("lawsuitDetails",v)} placeholder="Court, plaintiff, amount at issue" hasError={!!e("lawsuitDetails")}/>{e("lawsuitDetails") && <p className="text-xs text-red-400 mt-1">⚠ {e("lawsuitDetails")}</p>}</div>}
            </Field>
            <Field label="Owned or operated a business in the last 4 years?" error={e("ownedBusiness")}>
              <RadioGroup name="biz" current={data.ownedBusiness} onChange={v=>u("ownedBusiness",v)} error={e("ownedBusiness")} options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
              {data.ownedBusiness==="yes" && <div className="mt-2"><Input value={data.businessDetails} onChange={v=>u("businessDetails",v)} placeholder="Business name, type, dates of operation" hasError={!!e("businessDetails")}/>{e("businessDetails") && <p className="text-xs text-red-400 mt-1">⚠ {e("businessDetails")}</p>}</div>}
            </Field>
            <Field label="Expecting a tax refund this year?" error={e("expectedRefund")}>
              <RadioGroup name="refund" current={data.expectedRefund} onChange={v=>u("expectedRefund",v)} error={e("expectedRefund")} options={[{value:"yes",label:"Yes"},{value:"no",label:"No"},{value:"unknown",label:"Don't know"}]}/>
              {data.expectedRefund==="yes" && <div className="mt-2"><Input type="number" value={data.refundAmount} onChange={v=>u("refundAmount",v)} placeholder="Estimated refund $" hasError={!!e("refundAmount")}/>{e("refundAmount") && <p className="text-xs text-red-400 mt-1">⚠ {e("refundAmount")}</p>}</div>}
            </Field>
            <Field label="Do you pay domestic support (child support / alimony)?" error={e("dsoObligation")}>
              <RadioGroup name="dso" current={data.dsoObligation} onChange={v=>u("dsoObligation",v)} error={e("dsoObligation")} options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
              {data.dsoObligation==="yes" && <div className="mt-2"><Input type="number" value={data.dsoAmount} onChange={v=>u("dsoAmount",v)} placeholder="Monthly amount $" hasError={!!e("dsoAmount")}/>{e("dsoAmount") && <p className="text-xs text-red-400 mt-1">⚠ {e("dsoAmount")}</p>}</div>}
            </Field>
            <Field label="Luxury purchases over $800 or cash advances over $1,125 in the last 90 days?" error={e("recentLuxury")}>
              <RadioGroup name="luxury" current={data.recentLuxury} onChange={v=>u("recentLuxury",v)} error={e("recentLuxury")} options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
              {data.recentLuxury==="yes" && <div className="mt-2"><Input value={data.luxuryDetails} onChange={v=>u("luxuryDetails",v)} placeholder="Describe the purchases" hasError={!!e("luxuryDetails")}/>{e("luxuryDetails") && <p className="text-xs text-red-400 mt-1">⚠ {e("luxuryDetails")}</p>}</div>}
            </Field>
            <Field label="Currently subject to wage garnishment or bank levy?" error={e("garnishment")}>
              <RadioGroup name="garnish" current={data.garnishment} onChange={v=>u("garnishment",v)} error={e("garnishment")} options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
            </Field>
            {data.garnishment==="yes" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Who is garnishing you? (Creditor / Creditor's attorney)">
                    <Input value={data.garnishmentCreditor} onChange={v=>u("garnishmentCreditor",v)} placeholder="e.g. Capital One, IRS, Child Support Division"/>
                  </Field>
                  <Field label="How much is being garnished per month?">
                    <Input type="number" value={data.garnishmentMonthlyAmount} onChange={v=>u("garnishmentMonthlyAmount",v)} placeholder="e.g. 350"/>
                  </Field>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/25 mt-1">
                  <p className="text-xs text-blue-300 font-semibold">Important: Once your bankruptcy case is filed, the automatic stay takes effect immediately and stops all wage garnishments and bank levies. Your take-home pay will return to the full amount.</p>
                  {parseFloat(data.garnishmentMonthlyAmount)>0 && (
                    <p className="text-xs text-blue-200 mt-1">Your income will increase by approximately <strong>${parseFloat(data.garnishmentMonthlyAmount||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}/month</strong> once the stay is in place.</p>
                  )}
                </div>
              </>
            )}
            <Field label="Is there an active foreclosure on your home?">
              <RadioGroup name="foreclosurePending" current={data.foreclosurePending} onChange={v=>u("foreclosurePending",v)} options={[{value:"yes",label:"Yes"},{value:"no",label:"No"},{value:"unknown",label:"Not sure"}]}/>
            </Field>
            {data.foreclosurePending==="yes" && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                <p className="text-xs text-red-300 font-bold mb-2">URGENT — Filing bankruptcy before the foreclosure sale date triggers the automatic stay, which immediately halts the foreclosure. Do not delay.</p>
                <Field label="Foreclosure sale date (if you know it)">
                  <Input value={data.foreclosureDate} onChange={v=>u("foreclosureDate",v)} placeholder="MM/DD/YYYY"/>
                </Field>
              </div>
            )}
          </SectionCard>
          <ErrorBanner errors={errors}/>
        </div>
      );

      case 8: return (
        <div>
          <SectionCard title="Personal Injury Screening" icon="⚕️">
            <div className="mb-4 p-3.5 bg-blue-500/8 border border-blue-500/25 rounded-xl">
              <p className="text-xs text-blue-300 leading-relaxed">This section helps us identify whether you may have a separate personal injury or accident claim. Your answers are kept confidential and will only be reviewed by our attorneys.</p>
            </div>
            <Field label="Have you been injured or in a car accident where you might have a claim against another person or company?" error={e("piHasClaim")}>
              <RadioGroup name="piHasClaim" current={data.piHasClaim} onChange={v=>u("piHasClaim",v)} error={e("piHasClaim")} options={[{value:"yes",label:"Yes — I may have a personal injury claim"},{value:"no",label:"No"}]}/>
            </Field>
          </SectionCard>

          {data.piHasClaim === "yes" && (
            <>
              <SectionCard title="Incident Details" icon="📋">
                <Field label="Date of Loss / Incident Date" error={e("piDateOfLoss")}>
                  <Input type="date" value={data.piDateOfLoss} onChange={v=>u("piDateOfLoss",v)} hasError={!!e("piDateOfLoss")}/>
                </Field>
                <Field label="Describe what happened" error={e("piIncidentDescription")}>
                  <textarea
                    value={data.piIncidentDescription}
                    onChange={ev=>u("piIncidentDescription",ev.target.value)}
                    rows={3}
                    placeholder="Briefly describe the incident — type of accident, circumstances, how it occurred..."
                    className={`w-full bg-slate-900 border ${e("piIncidentDescription")?"border-red-500":"border-slate-600"} rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 resize-none`}
                  />
                </Field>
                <Field label="Where did the incident occur? (Location)">
                  <Input value={data.piIncidentLocation} onChange={v=>u("piIncidentLocation",v)} placeholder="City, State — e.g. intersection, business name, highway"/>
                </Field>
              </SectionCard>

              <SectionCard title="At-Fault Party Information" icon="👤">
                <p className="text-xs text-slate-400 mb-3">Provide details about the person or entity you believe is responsible.</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="At-Fault Party Name">
                    <Input value={data.piAtFaultName} onChange={v=>u("piAtFaultName",v)} placeholder="Full name or company name"/>
                  </Field>
                  <Field label="At-Fault Party Phone">
                    <Input type="tel" value={data.piAtFaultPhone} onChange={v=>u("piAtFaultPhone",v)} placeholder="(555) 555-5555"/>
                  </Field>
                </div>
                <Field label="At-Fault Party's Insurance Carrier">
                  <Input value={data.piAtFaultInsurance} onChange={v=>u("piAtFaultInsurance",v)} placeholder="Insurance company name (e.g. State Farm, Allstate)"/>
                </Field>
                <Field label="Any other parties involved? (describe)">
                  <Input value={data.piOtherParties} onChange={v=>u("piOtherParties",v)} placeholder="Names, roles, or descriptions of other parties involved"/>
                </Field>
              </SectionCard>

              <SectionCard title="Police Report" icon="🚔">
                <Field label="Was a police report filed?" error={e("piPoliceReport")}>
                  <RadioGroup name="piPoliceReport" current={data.piPoliceReport} onChange={v=>u("piPoliceReport",v)} error={e("piPoliceReport")} options={[{value:"yes",label:"Yes"},{value:"no",label:"No"},{value:"unknown",label:"I don't know"}]}/>
                </Field>
                {data.piPoliceReport === "yes" && (
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <Field label="Report Number (if known)">
                      <Input value={data.piPoliceReportNumber} onChange={v=>u("piPoliceReportNumber",v)} placeholder="e.g. 2024-001234"/>
                    </Field>
                    <Field label="Police Department / Agency">
                      <Input value={data.piPoliceDepartment} onChange={v=>u("piPoliceDepartment",v)} placeholder="e.g. Miami Police Department"/>
                    </Field>
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Injuries & Medical Treatment" icon="🏥">
                <Field label="Were you injured in the incident?" error={e("piWasInjured")}>
                  <RadioGroup name="piWasInjured" current={data.piWasInjured} onChange={v=>u("piWasInjured",v)} error={e("piWasInjured")} options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
                </Field>
                {data.piWasInjured === "yes" && (
                  <Field label="Describe your injuries">
                    <textarea
                      value={data.piInjuryDescription}
                      onChange={ev=>u("piInjuryDescription",ev.target.value)}
                      rows={2}
                      placeholder="e.g. broken arm, whiplash, back injury, head trauma..."
                      className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 resize-none"
                    />
                  </Field>
                )}
                <Field label="Have you received medical treatment?">
                  <RadioGroup name="piMedicalTreatment" current={data.piMedicalTreatment} onChange={v=>u("piMedicalTreatment",v)} options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
                </Field>
                {data.piMedicalTreatment === "yes" && (
                  <Field label="Medical Provider / Hospital Name">
                    <Input value={data.piMedicalProvider} onChange={v=>u("piMedicalProvider",v)} placeholder="e.g. Jackson Memorial Hospital, Dr. Smith"/>
                  </Field>
                )}
                <Field label="Was there property damage (vehicle, personal property)?">
                  <RadioGroup name="piPropertyDamage" current={data.piPropertyDamage} onChange={v=>u("piPropertyDamage",v)} options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
                </Field>
                {data.piPropertyDamage === "yes" && (
                  <Field label="Describe the property damage">
                    <Input value={data.piPropertyDamageDesc} onChange={v=>u("piPropertyDamageDesc",v)} placeholder="e.g. totaled vehicle, damaged phone, etc."/>
                  </Field>
                )}
              </SectionCard>

              <SectionCard title="Legal Representation" icon="⚖️">
                <Field label="Have you already hired an attorney for this injury claim?" error={e("piHasAttorney")}>
                  <RadioGroup name="piHasAttorney" current={data.piHasAttorney} onChange={v=>u("piHasAttorney",v)} error={e("piHasAttorney")} options={[{value:"yes",label:"Yes — I already have a PI attorney"},{value:"no",label:"No — I do not have an attorney"}]}/>
                </Field>

                {data.piHasAttorney === "yes" && (
                  <div className="mt-3 space-y-3">
                    <p className="text-xs text-slate-400">Please provide your current attorney's contact information.</p>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Attorney Name">
                        <Input value={data.piAttorneyName} onChange={v=>u("piAttorneyName",v)} placeholder="Attorney's full name"/>
                      </Field>
                      <Field label="Attorney Phone">
                        <Input type="tel" value={data.piAttorneyPhone} onChange={v=>u("piAttorneyPhone",v)} placeholder="(555) 555-5555"/>
                      </Field>
                    </div>
                    <Field label="Law Firm Name">
                      <Input value={data.piAttorneyFirm} onChange={v=>u("piAttorneyFirm",v)} placeholder="Law firm or office name"/>
                    </Field>
                    <div className="p-3 bg-slate-800/60 border border-slate-700 rounded-xl">
                      <p className="text-xs text-slate-400 leading-relaxed">Since you already have legal representation for this matter, our office will note your existing attorney's information in your file. You may still proceed with your bankruptcy intake below.</p>
                    </div>
                  </div>
                )}

                {data.piHasAttorney === "no" && (
                  <div className="mt-3">
                    <Field label="Any additional notes about the incident or claim?">
                      <textarea
                        value={data.piAdditionalNotes}
                        onChange={ev=>u("piAdditionalNotes",ev.target.value)}
                        rows={2}
                        placeholder="Anything else you think our attorney should know..."
                        className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 resize-none"
                      />
                    </Field>

                    {piSubmitStatus === "idle" || piSubmitStatus === "error" ? (
                      <div className="mt-4">
                        <div className="p-4 bg-amber-400/8 border border-amber-400/30 rounded-xl mb-3">
                          <p className="text-sm font-semibold text-amber-300 mb-1">Submit Your Personal Injury Information</p>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            Our attorney will review the details of your potential personal injury claim and determine if the firm can assist you. You will be notified of the outcome. After submitting, you will continue with the rest of your bankruptcy intake.
                          </p>
                        </div>
                        {piSubmitStatus === "error" && (
                          <p className="text-xs text-red-400 mb-2">There was an issue submitting your PI information. Please try again.</p>
                        )}
                        <button
                          onClick={submitPiIntake}
                          className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold text-sm transition-colors"
                        >
                          Submit PI Information for Attorney Review
                        </button>
                      </div>
                    ) : piSubmitStatus === "submitting" ? (
                      <div className="mt-4 p-4 bg-slate-800 border border-slate-700 rounded-xl text-center">
                        <p className="text-sm text-slate-400">Submitting your personal injury information...</p>
                      </div>
                    ) : (
                      <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                        <p className="text-sm font-bold text-green-300 mb-1">Personal Injury Information Submitted</p>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          An attorney from our office will review the details of your potential personal injury claim shortly. You will be notified once the review is complete. Please continue below to complete your bankruptcy intake.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </SectionCard>
            </>
          )}

          {data.piHasClaim === "no" && (
            <div className="p-4 bg-slate-800/40 border border-slate-700 rounded-xl mt-2">
              <p className="text-sm text-slate-400">No personal injury claim noted. You may continue to the next section.</p>
            </div>
          )}

          <ErrorBanner errors={errors}/>
        </div>
      );

      case 9: return (
        <div>
          {!submitted ? (
            <>
              <SectionCard title="Filer Information" icon="👤">
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <div><span className="text-slate-400 text-xs">Name</span><p className="text-white font-medium">{data.firstName} {data.lastName}{(data.filingType==="joint"||data.filingType==="individual-nonfiling-spouse")?` & ${data.spouseFirstName} ${data.spouseLastName}`:""}</p></div>
                  <div><span className="text-slate-400 text-xs">Filing Type</span><p className="text-white font-medium capitalize">{data.filingType||"—"}</p></div>
                  <div><span className="text-slate-400 text-xs">Email</span><p className="text-white font-medium">{data.email||"—"}</p></div>
                  <div><span className="text-slate-400 text-xs">Phone</span><p className="text-white font-medium">{data.phone||"—"}</p></div>
                  <div className="col-span-2"><span className="text-slate-400 text-xs">Current Address</span>
                    <p className="text-white font-medium">
                      {[data.address, data.city, data.state && data.zip ? `${data.state} ${data.zip}` : data.state || data.zip].filter(Boolean).join(", ") || "—"}
                    </p>
                    {data.county && <p className="text-slate-400 text-xs">{data.county} County</p>}
                  </div>
                  <div><span className="text-slate-400 text-xs">Marital Status</span><p className="text-white font-medium capitalize">{data.maritalStatus||"—"}</p></div>
                  <div><span className="text-slate-400 text-xs">Household Size</span><p className="text-white font-medium">{parseInt(data.numDependents||0)+((data.filingType==="joint"||data.filingType==="individual-nonfiling-spouse")?2:1)} people</p></div>
                </div>
              </SectionCard>
              <SectionCard title="Income Summary" icon="💼">
                <div className="border-t border-slate-600 mt-2 pt-2 flex justify-between items-center">
                  <span className="text-sm font-semibold text-slate-300">Total Monthly Income</span>
                  <span className="text-xl font-serif font-bold text-amber-400">${totalIncome().toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                </div>
              </SectionCard>
              <SectionCard title="Monthly Expenses" icon="🧾">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-slate-300">Total Monthly Expenses</span>
                  <span className="text-xl font-serif font-bold text-amber-400">${totalExpenses().toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-slate-400">Monthly surplus / deficit</span>
                  <span className={`text-sm font-semibold ${(totalIncome()-totalExpenses())>=0?"text-green-400":"text-red-400"}`}>
                    {(totalIncome()-totalExpenses())>=0?"+":""}{(totalIncome()-totalExpenses()).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}
                  </span>
                </div>
              </SectionCard>
              <SectionCard title="Debt Summary" icon="💳">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-slate-300">Total Debt</span>
                  <span className="text-xl font-serif font-bold text-red-400">${totalDebt().toLocaleString("en-US",{maximumFractionDigits:0})}</span>
                </div>
              </SectionCard>
              <SectionCard title="Official Bankruptcy Information Sheet" icon="📜">
                <p className="text-xs text-slate-300 mb-3 leading-relaxed">Before filing for bankruptcy, federal law requires that you receive this notice prepared pursuant to 11 U.S.C. § 342(b).</p>
                <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 text-xs text-slate-300 leading-relaxed space-y-3 mb-4 max-h-48 overflow-y-auto">
                  <p className="font-semibold text-white">CHAPTER 7 — Liquidation</p>
                  <p>Chapter 7 is designed for debtors in financial difficulty who do not have the ability to pay their existing debts. A court-appointed trustee may liquidate your non-exempt property to pay your creditors. The purpose of filing a Chapter 7 case is to obtain a discharge of your existing debts.</p>
                  <p className="font-semibold text-white">CHAPTER 13 — Repayment Plan</p>
                  <p>Chapter 13 is designed for individuals with regular income who would like to pay all or part of their debts in installments over a period of time. Under Chapter 13, you must file with the court a plan to repay your creditors.</p>
                  <p className="font-semibold text-white">BANKRUPTCY CRIMES WARNING</p>
                  <p>A person who knowingly and fraudulently conceals assets or makes a false oath in connection with a bankruptcy case is subject to a fine, imprisonment, or both. All information is subject to examination by the U.S. Trustee.</p>
                </div>
                <button onClick={()=>u("readInfoSheet",!data.readInfoSheet)}
                  className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all ${data.readInfoSheet?"bg-blue-500/10 border-blue-500 text-blue-300":"bg-slate-800 border-slate-600 text-slate-300 hover:border-blue-400/60"}`}>
                  <span className={`w-6 h-6 rounded border-2 flex-shrink-0 flex items-center justify-center mt-0.5 ${data.readInfoSheet?"bg-blue-500 border-blue-500":"border-slate-500"}`}>
                    {data.readInfoSheet && <span className="text-white text-xs font-black">✓</span>}
                  </span>
                  <span className="text-sm font-semibold">I have read and acknowledge the Official Bankruptcy Information Sheet required under 11 U.S.C. § 342(b).</span>
                </button>
                {e("readInfoSheet") && <p className="text-xs text-red-400 mt-2">⚠ {e("readInfoSheet")}</p>}
              </SectionCard>
              <SectionCard title="Certification & Acknowledgment" icon="✍️">
                <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 mb-4 text-xs text-slate-300 leading-relaxed space-y-3">
                  <p>By submitting this form, I certify that all information I have provided is <strong className="text-white">true, correct, and complete</strong> to the best of my knowledge and belief.</p>
                  <p className="text-amber-300 font-semibold">IMPORTANT — PLEASE READ:</p>
                  <p>This intake questionnaire is for <strong className="text-white">informational purposes only</strong> and does not constitute legal advice. No <strong className="text-white">attorney-client relationship</strong> is formed by submitting this form. Consult a licensed bankruptcy attorney before making any legal decisions.</p>
                  <div className="border-t border-slate-600 pt-3 mt-3">
                    <p className="text-red-400 font-semibold mb-2">ACCURACY WARNING — PLEASE READ CAREFULLY:</p>
                    <p>I understand that if any information provided in this questionnaire is <strong className="text-white">inaccurate, inconsistent with actual facts, or omitted</strong>, it may materially impact my eligibility for bankruptcy relief. Specifically, such discrepancies could result in: (1) qualification for a <strong className="text-white">different chapter of bankruptcy</strong> than anticipated (e.g., Chapter 7 vs. Chapter 13); or (2) <strong className="text-white">complete ineligibility</strong> for bankruptcy protection altogether. I accept full responsibility for ensuring all information submitted is truthful and complete.</p>
                  </div>
                </div>
                <button onClick={()=>u("confirmedAccurate",!data.confirmedAccurate)}
                  className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all ${data.confirmedAccurate?"bg-green-400/10 border-green-400 text-green-300":"bg-slate-800 border-slate-600 text-slate-300 hover:border-amber-400/60"}`}>
                  <span className={`w-6 h-6 rounded border-2 flex-shrink-0 flex items-center justify-center mt-0.5 ${data.confirmedAccurate?"bg-green-400 border-green-400":"border-slate-500"}`}>
                    {data.confirmedAccurate && <span className="text-slate-900 text-xs font-black">✓</span>}
                  </span>
                  <span className="text-sm font-semibold leading-snug">I certify that all information is true, correct, and complete. I understand this does not constitute legal advice or create an attorney-client relationship.</span>
                </button>
                {e("confirmedAccurate") && <p className="text-xs text-red-400 mt-2">⚠ {e("confirmedAccurate")}</p>}
              </SectionCard>
              <div className="mb-4">
                <button onClick={submitIntake} disabled={submitting || !data.confirmedAccurate || !data.readInfoSheet}
                  className={`w-full font-bold py-4 px-4 rounded-xl transition-all text-sm uppercase tracking-wider flex items-center justify-center gap-2 ${submitting?"bg-slate-600 text-slate-400 cursor-not-allowed":(!data.confirmedAccurate || !data.readInfoSheet)?"bg-slate-700 text-slate-500 cursor-not-allowed":"bg-amber-400 hover:bg-amber-300 text-slate-900"}`}>
                  {submitting ? <><span className="animate-pulse">⏳</span> Submitting…</> : <><span>📬</span> Submit to Our Office for Review</>}
                </button>
              </div>
              <ErrorBanner errors={errors}/>
            </>
          ) : (
            <div>
              <div className="bg-gradient-to-br from-green-500/10 to-slate-900 border border-green-500/30 rounded-2xl p-6 mb-5 text-center">
                <div className="text-5xl mb-3">✅</div>
                <p className="font-serif text-2xl font-bold text-white mb-2">Your Information Has Been Received</p>
                {submitRef && (
                  <div className="inline-block bg-slate-800/80 rounded-xl px-4 py-2 mb-3">
                    <p className="text-xs text-slate-400 mb-0.5">Reference Number</p>
                    <p className="font-mono font-bold text-amber-400 text-base">{submitRef}</p>
                  </div>
                )}
                <p className="text-slate-300 text-sm leading-relaxed max-w-md mx-auto">
                  Thank you for completing your intake. Our attorney is being notified now and will review your case. Our team will contact you shortly to discuss your options.
                </p>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-5">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">What Happens Next</p>
                <div className="space-y-2.5">
                  {[
                    { step: "1", title: "Attorney Review", desc: "Your case is being reviewed by our attorney now — usually within 1 business day.", color: "bg-amber-400/15 text-amber-400" },
                    { step: "2", title: "Our Team Contacts You", desc: "A member of our legal team will call or message you to discuss findings and next steps.", color: "bg-blue-500/15 text-blue-400" },
                    { step: "3", title: "Case Decision & Fees", desc: "If your case is accepted, we will present your options, fees, and timeline.", color: "bg-green-500/15 text-green-400" },
                  ].map(s => (
                    <div key={s.step} className="flex items-start gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-extrabold ${s.color}`}>{s.step}</div>
                      <div>
                        <p className="text-xs font-bold text-white">{s.title}</p>
                        <p className="text-xs text-slate-400">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-slate-800/80 border border-amber-400/30 rounded-2xl p-5 mb-5">
                <p className="font-serif text-lg font-bold text-white mb-1">Contact Our Office Now</p>
                <p className="text-xs text-slate-400 mb-5 leading-relaxed">Don't wait — reach out now and we can start your review immediately.</p>
                <div className="grid grid-cols-1 gap-3">
                  <a href="tel:+18005551234" className="flex items-center gap-4 p-4 bg-green-500/15 hover:bg-green-500/25 border border-green-500/40 hover:border-green-400 rounded-xl transition-all no-underline">
                    <span className="text-3xl flex-shrink-0">📞</span>
                    <div>
                      <p className="font-bold text-green-400 text-sm">Call Our Office Now</p>
                      <p className="font-mono font-bold text-green-300 text-base">(800) 555-1234</p>
                      <p className="text-xs text-slate-400 mt-0.5">Speak with someone right away</p>
                    </div>
                  </a>
                  <button onClick={()=>setScheduleState("form")} className="flex items-center gap-4 p-4 bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/40 hover:border-amber-400 rounded-xl transition-all text-left">
                    <span className="text-3xl flex-shrink-0">📅</span>
                    <div>
                      <p className="font-bold text-amber-400 text-sm">Schedule a Consultation</p>
                      <p className="text-xs text-slate-300 mt-0.5">Pick a date and time — we will confirm within one hour</p>
                    </div>
                  </button>
                </div>
              </div>
              <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-4 mb-5 text-xs text-slate-500 leading-relaxed">
                <p className="text-slate-400 font-semibold mb-2">Important Notice</p>
                <p>Submission of this form does not create an attorney-client relationship. Nothing on this website constitutes legal advice. You are encouraged to consult with a licensed bankruptcy attorney to obtain advice tailored to your individual situation.</p>
              </div>
              {scheduleState === "form" && (
                <div className="bg-slate-800 border border-amber-400/40 rounded-2xl p-5 mb-4">
                  <div className="flex items-center justify-between mb-4">
                    <p className="font-serif font-bold text-white">Schedule a Consultation</p>
                    <button onClick={()=>setScheduleState("idle")} className="text-slate-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700">✕</button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-widest text-amber-400 mb-1">Name</label>
                      <input value={appt.name} onChange={e=>setAppt(a=>({...a,name:e.target.value}))} placeholder="Full name" className="w-full bg-slate-900 border border-slate-600 focus:border-amber-400 rounded-lg px-3 py-2 text-white text-sm focus:outline-none placeholder-slate-500"/>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-widest text-amber-400 mb-1">Phone</label>
                      <input value={appt.phone} onChange={e=>setAppt(a=>({...a,phone:e.target.value}))} placeholder="(555) 555-5555" className="w-full bg-slate-900 border border-slate-600 focus:border-amber-400 rounded-lg px-3 py-2 text-white text-sm focus:outline-none placeholder-slate-500"/>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-widest text-amber-400 mb-1">Preferred Date</label>
                      <input type="date" value={appt.preferredDate} onChange={e=>setAppt(a=>({...a,preferredDate:e.target.value}))} className="w-full bg-slate-900 border border-slate-600 focus:border-amber-400 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"/>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-widest text-amber-400 mb-1">Preferred Time</label>
                      <select value={appt.preferredTime} onChange={e=>setAppt(a=>({...a,preferredTime:e.target.value}))} className="w-full bg-slate-900 border border-slate-600 focus:border-amber-400 rounded-lg px-3 py-2 text-white text-sm focus:outline-none">
                        <option value="">Select time...</option>
                        {["8:00 AM","9:00 AM","10:00 AM","11:00 AM","12:00 PM","1:00 PM","2:00 PM","3:00 PM","4:00 PM","5:00 PM"].map(t=><option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="block text-xs font-semibold uppercase tracking-widest text-amber-400 mb-1">Consultation Type</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[["phone","📞","Phone"],["video","💻","Video"],["inperson","🏢","In Person"]].map(([v,icon,lbl])=>(
                        <button key={v} onClick={()=>setAppt(a=>({...a,consultType:v}))}
                          className={`flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-semibold transition-all ${appt.consultType===v?"bg-amber-400/10 border-amber-400 text-amber-400":"bg-slate-900 border-slate-600 text-slate-400 hover:border-slate-400"}`}>
                          <span className="text-lg">{icon}</span>{lbl}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={()=>setScheduleState("sent")} disabled={!appt.name||!appt.phone||!appt.preferredDate||!appt.preferredTime}
                    className={`w-full font-bold py-3 rounded-xl text-sm uppercase tracking-wider ${!appt.name||!appt.phone||!appt.preferredDate||!appt.preferredTime?"bg-slate-600 text-slate-400 cursor-not-allowed":"bg-amber-400 hover:bg-amber-300 text-slate-900"}`}>
                    Confirm Consultation Request →
                  </button>
                  {scheduleState==="sent" && <div className="mt-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-xs text-green-300 text-center">✅ Consultation request received — we will confirm within 1 hour.</div>}
                </div>
              )}
            </div>
          )}
        </div>
      );

      default: return null;
    }
  };

  const stepIntros = [
    {icon:"👤",title:"Let's start with who is filing",body:"We need your basic contact information and filing type to set up your case file. If you are married and filing individually, your attorney will explain whether your spouse's information is required. Everything you share is kept strictly confidential."},
    {icon:"👨‍👩‍👧",title:"Tell us about your household",body:"Household size and composition is used as part of the Means Test — the income eligibility analysis required by federal bankruptcy law. The number of people in your household affects the applicable income thresholds that your attorney will use to evaluate your situation."},
    {icon:"💰",title:"Your income over the past 6 months",body:"Federal bankruptcy law requires full disclosure of all income received in the 6 months before filing. This information is used to calculate your Current Monthly Income (CMI), which is compared against your state's median income as part of the Means Test (Official Form 122A). Your attorney will use this data to complete the full analysis."},
    {icon:"🏠",title:"Real estate and property you own",body:"All real estate interests must be disclosed. The equity in your property — the difference between its market value and what you owe — is an important factor because it determines whether an exemption may apply. An exemption is a legal protection that may allow you to keep certain property in bankruptcy. Your attorney will review which exemptions are available based on your state's laws."},
    {icon:"🚗",title:"Your vehicles and personal assets",body:"Every asset you own must be listed on your bankruptcy schedules, regardless of its value. As with real estate, the equity in each asset and whether an exemption applies will be evaluated by your attorney. A bankruptcy trustee — the court-appointed official who administers your case — will review these disclosures to ensure completeness and accuracy."},
    {icon:"📊",title:"Your monthly living expenses",body:"Your monthly expenses are reported on Official Form 106J (Schedule J) and are required for your court filings. Accurate expense information is also used as part of the Means Test to calculate your disposable income. Please be thorough and honest — your attorney will review these figures with you."},
    {icon:"💳",title:"What you owe and to whom",body:"All debts must be disclosed on your bankruptcy schedules — this includes credit cards, medical bills, loans, and any other obligations. Your attorney will review the type and composition of your debts, which can affect how they are treated in bankruptcy. No debt should be omitted, even if you intend to continue paying it."},
    {icon:"📋",title:"Recent financial history",body:"Bankruptcy law requires full disclosure of your recent financial activity, including asset transfers, large payments, and other transactions from the prior 2–4 years. This information is reviewed by the bankruptcy trustee to ensure there are no preferential transfers or other issues that could affect your case."},
    {icon:"⚕️",title:"Personal injury & accident screening",body:"Before completing your bankruptcy intake, we ask a brief question about whether you may have a personal injury or accident claim against another party. If so, an attorney will separately review those details. This does not affect or delay your bankruptcy intake."},
    {icon:"✅",title:"Review and submit your information",body:"Please carefully review the summary below before submitting. Your attorney will use this information to prepare your official bankruptcy schedules. Accuracy is essential — errors or omissions may need to be corrected with the court."},
  ];

  return (
    <div className="min-h-screen bg-slate-950 font-sans" ref={topRef}>
      {!started ? (
        <div className="min-h-screen flex flex-col">
          <div className="bg-slate-900 border-b border-slate-800 px-4 py-4">
            <div className="max-w-lg mx-auto">
              <span className="font-serif text-lg font-bold text-white">bankruptcy</span>
              <span className="font-serif text-lg font-bold text-amber-400">.AI</span>
            </div>
          </div>
          <div className="flex-1 max-w-xl mx-auto w-full px-4 py-10">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-400/10 border-2 border-amber-400/30 mb-5">
                <span className="text-4xl">⚖️</span>
              </div>
              <h1 className="font-serif text-4xl font-bold text-white mb-3">
                Welcome to <span className="text-amber-400">Bankruptcy.AI</span>
              </h1>
              <p className="text-slate-400 text-base leading-relaxed">
                Let us begin gathering the information needed to review your bankruptcy and debt relief options.
              </p>
            </div>
            <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 mb-5">
              <p className="font-semibold text-white text-base mb-4">About This Questionnaire</p>
              <div className="space-y-3.5 text-sm text-slate-300 leading-relaxed">
                <div className="flex items-start gap-3"><span className="text-amber-400 text-base flex-shrink-0 mt-0.5">🕐</span><p>This questionnaire takes approximately <strong className="text-white">15 minutes</strong> to complete.</p></div>
                <div className="flex items-start gap-3"><span className="text-amber-400 text-base flex-shrink-0 mt-0.5">📋</span><p>This tool is designed to <strong className="text-white">gather information</strong> for attorney review. It is not a decision-making tool.</p></div>
                <div className="flex items-start gap-3"><span className="text-amber-400 text-base flex-shrink-0 mt-0.5">🔒</span><p>Your information is <strong className="text-white">kept confidential</strong> and will only be reviewed by our office.</p></div>
              </div>
            </div>
            <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-6 mb-6">
              <p className="font-semibold text-amber-400 text-sm uppercase tracking-widest mb-3">Important — Please Read Before Continuing</p>
              <div className="space-y-3 text-sm text-slate-400 leading-relaxed">
                <p><strong className="text-slate-300">Not Legal Advice.</strong> Nothing on this website or in this questionnaire constitutes legal advice. The information collected is for informational purposes only.</p>
                <p><strong className="text-slate-300">No Attorney-Client Relationship.</strong> Completing and submitting this questionnaire does not create an attorney-client relationship.</p>
                <p><strong className="text-slate-300">Bankruptcy.AI is Not a Law Firm.</strong> This tool exists to gather and organize your financial information so that it may be reviewed by a licensed attorney.</p>
                <p><strong className="text-slate-300">Consult an Attorney.</strong> You are encouraged to consult with a licensed bankruptcy attorney regarding your specific situation before making any decisions.</p>
              </div>
            </div>
            <div className="mb-8">
              <p className="text-sm text-slate-500 text-center leading-relaxed mb-5">
                By clicking "Begin Questionnaire" below, you confirm that you have read and understood the above, and you agree that this tool is for informational purposes only and does not create an attorney-client relationship.
              </p>
              <button onClick={()=>{ setStarted(true); topRef.current?.scrollIntoView({behavior:"smooth"}); }}
                className="w-full bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold py-4 rounded-xl text-base uppercase tracking-wider transition-all flex items-center justify-center gap-3 shadow-lg shadow-amber-400/20">
                <span>⚖️</span> Begin Questionnaire →
              </button>
              <p className="text-sm text-slate-600 text-center mt-3">Takes approximately 15 minutes — you can go back and edit your answers at any time</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-slate-600">Questions? Call us at <a href="tel:+18005551234" className="text-slate-500 hover:text-amber-400 transition-colors">(800) 555-1234</a></p>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div className="bg-slate-900 border-b border-slate-800 px-4 py-4 sticky top-0 z-10">
            <div className="max-w-5xl mx-auto flex items-center justify-between">
              <div>
                <span className="font-serif text-lg font-bold text-white">bankruptcy</span>
                <span className="font-serif text-lg font-bold text-amber-400">.AI</span>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-400">Step {step+1} of {SECTIONS.length}</p>
                <p className="text-sm text-amber-400 font-medium">{SECTIONS[step]}</p>
              </div>
            </div>
            <div className="max-w-5xl mx-auto mt-3">
              <div className="w-full bg-slate-800 rounded-full h-2">
                <div className="bg-amber-400 h-2 rounded-full transition-all duration-500" style={{width:`${(step/(SECTIONS.length-1))*100}%`}}/>
              </div>
              <div className="flex justify-between mt-2 gap-1">
                {SECTIONS.map((s,i)=>(
                  <button key={i} onClick={()=>i<step&&setStep(i)}
                    className={`text-sm flex-shrink-0 transition-colors ${i===step?"text-amber-400 font-semibold":i<step?"text-green-400 cursor-pointer":"text-slate-600"}`}>
                    {i<step?"✓":i+1}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {isStaffSession && (
            <div className={`px-4 py-3 border-b ${isTakeover ? 'bg-amber-900/80 border-amber-500/30' : 'bg-blue-900/70 border-blue-500/30'}`}>
              <div className="max-w-5xl mx-auto">
                <div className="flex items-start gap-3">
                  <span className={`flex-shrink-0 mt-0.5 font-bold text-base ${isTakeover ? 'text-amber-400' : 'text-blue-400'}`}>
                    {isTakeover ? '⚠' : 'ℹ'}
                  </span>
                  <div>
                    {isTakeover ? (
                      <>
                        <p className="text-xs font-bold text-amber-300 mb-0.5 uppercase tracking-wide">Legal Administrator — Staff-Assisted Session</p>
                        <p className="text-xs text-amber-200 leading-relaxed">
                          This intake is being completed by <span className="font-bold text-white">{staffMode.staffName}</span>, a Legal Administrator (non-attorney). {staffMode.staffName} is gathering information on behalf of the client to assist with intake completion. All information will be reviewed by a licensed attorney before any case decisions are made. No legal advice is being given, and no attorney-client relationship is formed at this stage.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-bold text-blue-300 mb-0.5 uppercase tracking-wide">Staff Read-Only View</p>
                        <p className="text-xs text-blue-200 leading-relaxed">
                          Viewing intake form for client. No changes can be submitted in this read-only session by <span className="font-bold text-white">{staffMode.staffName}</span>.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="max-w-5xl mx-auto px-4 py-6 pb-28 flex gap-6 items-start">
            <div className="flex-1 min-w-0">
              <h2 className="font-serif text-2xl font-bold text-white mb-2">{SECTIONS[step]}</h2>
              {stepIntros[step] && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 mb-6 flex gap-3">
                  <span className="text-2xl flex-shrink-0 mt-0.5">{stepIntros[step].icon}</span>
                  <div>
                    <p className="text-base font-semibold text-white mb-1.5">{stepIntros[step].title}</p>
                    <p className="text-sm text-slate-400 leading-relaxed">{stepIntros[step].body}</p>
                  </div>
                </div>
              )}
              {renderSection()}
            </div>
            <div className="hidden lg:flex flex-col w-80 flex-shrink-0 sticky top-20" style={{height:"520px"}}>
              <IntakeChatbot
                clientId={clientId}
                clientName={clientName}
                sessionId={sessionId}
                isAdmin={false}
              />
            </div>
          </div>
          <div className="lg:hidden fixed bottom-20 right-4 z-40 w-80">
            <IntakeChatbot
              clientId={clientId}
              clientName={clientName}
              sessionId={sessionId}
              isAdmin={false}
            />
          </div>
          {(step < 9 || (step === 9 && !submitted)) && (
            <div className="fixed bottom-0 left-0 right-0 bg-slate-950 border-t border-slate-800 px-4 py-4">
              <div className="max-w-5xl mx-auto flex gap-3">
                {step > 0 && (
                  <button onClick={()=>{setErrors({});setStep(s=>s-1);topRef.current?.scrollIntoView({behavior:"smooth"});}}
                    className="flex-1 border border-slate-600 text-slate-300 hover:border-slate-400 font-semibold py-3.5 rounded-xl transition-colors text-base">
                    ← Back
                  </button>
                )}
                {step < 9 && (
                  <button
                    onClick={() => {
                      if (step === 8 && data.piHasClaim === "yes" && data.piHasAttorney === "no" && !data.piSubmitted) {
                        submitPiIntake().then(() => handleContinue());
                      } else {
                        handleContinue();
                      }
                    }}
                    className="flex-1 font-bold py-3.5 rounded-xl transition-colors text-base uppercase tracking-wider bg-amber-400 hover:bg-amber-300 text-slate-900">
                    Continue →
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
