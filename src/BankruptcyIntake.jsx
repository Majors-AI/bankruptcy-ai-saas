import { useState, useRef, useMemo, useEffect } from "react";
import { supabase } from "./lib/supabase";
import { createLeadAndSubmission } from "./lib/createLead";
import IntakeChatbot from "./components/IntakeChatbot";
import PageContainer from "./components/layout/PageContainer";
import irsData from "./data/irs_standards_az_wa_ca_(1).json";

const US_STATES = ["Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming","District of Columbia"];
const SECTIONS  = ["👤 Who is Filing Bankruptcy?","👨‍👩‍👧 Household Size Details","💰 All Household Income","🏡 Real Estate Ownership Details","🚗 Personal Property Details","📊 Current Monthly Expenses","💳 Creditor Information","Financial History","Personal Injury Screening","Review & Submit"];

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

// Median income reads come from the centralized legal-reference store
// (src/lib/irsMeansStandards.ts → MEDIAN_INCOME_BY_STATE). The old local
// MEDIAN_INCOME table + MEDIAN_DATE constant were removed so editing the
// store propagates here automatically.
import { getMedianAnnualIncome as storeGetMedian, MEDIAN_INCOME_META, getHousing2025 as storeGetHousing2025, getNationalStandard2025 as storeGetNS2025 } from "./lib/irsMeansStandards";
const MEDIAN_DATE = MEDIAN_INCOME_META.effectiveDate;
const getMedian = (state, hhSize) => storeGetMedian(state, hhSize);

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

// VEHICLE_TYPES is now ONLY for primary on-road vehicles. Recreational types
// (motorcycle, RV, ATV, boat, jet ski, snowmobile, plane, helicopter) moved
// to the Recreational Vehicles & Watercraft section so the two question sets
// don't overlap and so financed recreational items flow into Schedule D via
// the recreationalVehicles[] array instead of being mixed with daily-driver
// vehicles.
const VEHICLE_TYPES = [
  "Car / Truck / SUV / Van","Other Titled Vehicle",
];

const emptyVehicle = (id) => ({ id, type:"", year:"", make:"", model:"", value:"", valueDate:"", valueConfirmed:false, intent:"", hasLoan:"", loanBalance:"", monthlyPayment:"", interestRate:"", lenderName:"", isLease:"", purchaseDate:"", hasHandicapPlacard:"", valuationStatus:"idle", valuationResult:null, valuationError:null, valuationOverride:false, overrideReason:"", overrideDetails:"", ownershipType:"", ownedBeforeMarriage:"", maritalFundsUsed:"", hasPrenup:"", inheritedOrGift:"", communityPropFlag:false });

const KBB_TYPES = ["Car / Truck / SUV / Van"];
const NADA_TYPES = ["Other Titled Vehicle"];
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
  // Prefer the centralized legal-reference store so attorney edits in the
  // LegalReferenceStore National Standards tab propagate here. Falls back
  // to the local IRS_STANDARDS_2025 table only when the store value is null
  // (e.g., outOfPocketHealth is intentionally null = TODO).
  const storeKeyMap = {
    food: 'food',
    housekeeping: 'housekeeping',
    apparel: 'apparel',
    personalCare: 'personalCare',
    miscellaneous: 'miscellaneous',
  };
  const k = storeKeyMap[category];
  if (k) {
    const fromStore = storeGetNS2025(k, hhSize);
    if (fromStore != null) return fromStore;
  }
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
  // Prefer the centralized store's 2025 housing-utilities bundle so
  // attorney edits in the LegalReferenceStore propagate here. Falls back
  // to the local irsData bundle only when the store has no value yet.
  const storeBundle = storeGetHousing2025(abbr, county, hhSize);
  const stateData = irsData.housing_and_utilities[abbr];
  const countyData = stateData?.[county];
  const key = String(Math.min(hhSize, 5));
  const localBundle = countyData?.[key];
  const bundle = storeBundle != null ? storeBundle : localBundle;
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
          <p className="text-xs text-amber-400 font-semibold mb-1">
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
    {title && (
      <div className="flex items-center gap-2.5 mb-5"><span className="text-2xl">{icon}</span><h3 className="font-serif text-lg font-semibold text-white">{title}</h3></div>
    )}
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
        <div className="p-3 rounded-lg bg-amber-400/10 border border-amber-400/30 text-xs text-amber-400 mb-3 leading-relaxed">
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
    : "bg-amber-400/10 border-amber-400/30 text-amber-400";
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

const SourceCard = ({ who, src, idx, total, onRemove, onUpdate, onError, periodToMonthly, workStatus, personName, sources }) => {
  const fmtD = n => n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
  const set  = (f,v) => onUpdate(who, idx, f, v);
  const err  = (f)   => onError(who, idx, f);
  const mg   = src.sourceType==="employment" ? periodToMonthly(src.grossPerPeriod, src.payFrequency) : (parseFloat(src.businessGrossIncome)||0);
  const bonus= src.sourceType==="employment" && src.receiveBonus==="yes" && src.bonusIncludedInIncome==="no" ? (parseFloat(src.bonusGross)||0)/12 : 0;

  // Gate Source Type options by the parent's workStatus so the client only
  // sees the relevant choice. "employed" → W-2 only; "selfEmployed" → self-
  // employment only; "both" → both options exist.
  const showW2 = workStatus === "employed" || workStatus === "both";
  const showSE = workStatus === "selfEmployed" || workStatus === "both";
  const lockedToType =
    workStatus === "employed" ? "employment" :
    workStatus === "selfEmployed" ? "selfEmployment" :
    null;
  // Compute per-type ordinal for the heading — e.g., "Dom Employer #2" or
  // "Self Employment Income #3". Counts only same-type entries up to and
  // including this one.
  const perTypeIndex = (sources || []).slice(0, idx + 1).filter(s => s.sourceType === src.sourceType).length;
  const heading = src.sourceType === "employment"
    ? `${personName || "Client"} — Employer #${perTypeIndex}`
    : src.sourceType === "selfEmployment"
      ? `Self-Employment Income #${perTypeIndex}`
      : `Income Source #${idx + 1}`;

  // If workStatus locks the type but the entry hasn't been set yet (new add),
  // initialize it to the locked type via effect. Done in effect (not during
  // render) so React doesn't see a setState during render.
  useEffect(() => {
    if (lockedToType && !src.sourceType) {
      set("sourceType", lockedToType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedToType, src.sourceType]);

  return (
    <div className="bg-slate-900/60 border border-slate-600 rounded-xl p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          {heading}
          {mg>0 && <span className="text-amber-400 ml-2">· ${fmtD(mg+bonus)}/mo</span>}
        </p>
        {total>1 && (
          <button onClick={onRemove} className="text-xs text-red-400 hover:text-red-300 border border-red-400/30 hover:border-red-400 px-2 py-1 rounded-lg transition-colors">Remove</button>
        )}
      </div>
      {/* Source-Type picker only when both types are possible ("both"
          workStatus). Otherwise the type is locked silently. */}
      {workStatus === "both" && (
        <Field label="Is this a W-2 job or your own business?" error={err("sourceType")}>
          <RadioGroup name={`${who}_${idx}_type`} current={src.sourceType} onChange={v=>set("sourceType",v)} error={err("sourceType")}
            options={[
              ...(showW2 ? [{value:"employment",label:"💼 W-2 job (regular paycheck from an employer)"}] : []),
              ...(showSE ? [{value:"selfEmployment",label:"🏢 My own business or self-employment (Uber, DoorDash, contractor, LLC, etc.)"}] : []),
            ]}/>
        </Field>
      )}
      {src.sourceType==="employment" && <>
        <Field label="Who do you work for?" hint="Name of the company on your paystub" error={err("employerName")}>
          <Input value={src.employerName} onChange={v=>set("employerName",v)} placeholder="e.g. Walmart, Acme Corp" hasError={!!err("employerName")}/>
        </Field>
        <Field label="How often do you get paid?" error={err("payFrequency")}>
          <Select value={src.payFrequency} onChange={v=>set("payFrequency",v)} hasError={!!err("payFrequency")}
            options={["Weekly","Bi-Weekly","Semi-Monthly","Monthly"]} placeholder="Pick one..."/>
        </Field>
        {src.payFrequency && <>
          <div className="grid grid-cols-2 gap-3">
            <Field label={src.payFrequency==="Monthly"?"How much do you make each month BEFORE taxes?":"How much do you make each paycheck BEFORE taxes?"} hint="The 'gross' number on your paystub" error={err("grossPerPeriod")}>
              <Input type="number" value={src.grossPerPeriod} onChange={v=>set("grossPerPeriod",v)} placeholder="Enter amount" hasError={!!err("grossPerPeriod")}/>
            </Field>
            <Field label={src.payFrequency==="Monthly"?"How much do you actually get each month (take-home)?":"How much do you actually get each paycheck (take-home)?"} hint="The 'net' number — what hits your bank account" error={err("netPerPeriod")}>
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
        <Field label="What's the name of this business or gig?" hint="One source per entry — list Uber, DoorDash, your own business, etc. separately" error={err("businessName")}>
          <Input value={src.businessName} onChange={v=>set("businessName",v)} placeholder="e.g. Uber, DoorDash, Smith Plumbing LLC" hasError={!!err("businessName")}/>
        </Field>
        <Field label="What kind of business is it?" hint="Just describe it in your own words" error={err("businessType")}>
          <Input value={src.businessType} onChange={v=>set("businessType",v)} placeholder="e.g. Rideshare driver, plumber, online seller, freelancer" hasError={!!err("businessType")}/>
        </Field>
        <Field label="How much money does this bring in each month (before expenses)?" hint="Total before any business costs" error={err("businessGrossIncome")}>
          <Input type="number" value={src.businessGrossIncome} onChange={v=>set("businessGrossIncome",v)} placeholder="Enter amount" hasError={!!err("businessGrossIncome")}/>
        </Field>
        {/* Business Expenses */}
        <div className="mt-1">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400">Monthly Business Operating Expenses</label>
            <button
              type="button"
              onClick={()=>{ const useItemized = !src.bizExpUseItemized; set("bizExpUseItemized",useItemized); if(!useItemized){["bizExpRent","bizExpPayroll","bizExpSupplies","bizExpEquipment","bizExpLicenses","bizExpMarketing","bizExpProfessional","bizExpInsurance","bizExpInventory","bizExpOther","bizExpOtherDesc"].forEach(f=>set(f,"")); set("businessExpenses",""); } }}
              className="text-xs text-amber-400 hover:text-amber-400 underline underline-offset-2 transition-colors"
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
                  <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-400">
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
        </div>
        {isEmployed && monthlyGrossTotal>0 && (
          <div className="text-right">
            <p className="text-xs text-slate-400">Gross/mo</p>
            <p className="text-lg font-serif font-bold text-amber-400">${monthlyGrossTotal.toLocaleString("en-US",{maximumFractionDigits:0})}</p>
          </div>
        )}
      </div>
      <Field label="What's your work situation right now?" error={onError(workStatusKey)}>
        <RadioGroup name={workStatusKey} current={workStatus} onChange={onStatusChange} error={onError(workStatusKey)}
          options={[
            {value:"employed", label:"💼 I have a regular job (W-2 employee)"},
            {value:"selfEmployed", label:"🏢 I work for myself (own business, Uber, DoorDash, freelance, etc.)"},
            {value:"both", label:"⚡ Both — I have a regular job AND a side business"},
            {value:"notEmployed", label:"🚫 I'm not working right now"},
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
              periodToMonthly={periodToMonthly}
              workStatus={workStatus} personName={personName} sources={sources}/>
          ))}
          <button onClick={()=>onAdd(who)}
            className="w-full border border-dashed border-amber-400/40 hover:border-amber-400 text-amber-400 hover:bg-amber-400/5 text-sm font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
            <span className="text-lg leading-none">+</span>
            {workStatus === "employed"
              ? `Add Another Employer for ${personName}`
              : workStatus === "selfEmployed"
                ? `Add Another Self-Employment Source for ${personName} (Uber, DoorDash, etc.)`
                : `Add Another Income Source for ${personName}`}
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

export default function BankruptcyIntake({
  clientId,
  clientName,
  clientEmail,
  clientPhone,
  staffMode,
  // ── Additive props for the staff-guided wrapper (StaffGuidedIntake). All
  //    optional; the public route at view='intake_questionnaire' calls this
  //    with no props and the behavior is unchanged.
  leadId = null,
  initialData,
  onStepChange,
  onSubmitted,
  // ── White-label firm config. Each firm / department can override the
  //    welcome screen, logo, contact info, and custom field help via the
  //    staff settings panel. Defaults below are used when nothing custom
  //    has been set so the form still works on the public route.
  firmConfig = {},
} = {}) {
  // Resolve white-label config with sensible defaults so the welcome page
  // and field-level help stay functional even when no firm-specific values
  // are provided. Each value can be overridden individually. The default
  // name reads "(Insert Law Firm Name)" so it's obvious during testing /
  // demo that the firm name will be injected from super-admin settings.
  const FIRM = {
    name: firmConfig.name ?? "(Insert Law Firm Name)",
    logoUrl: firmConfig.logoUrl ?? null, // null → default ⚖️ glyph
    phone: firmConfig.phone ?? "(800) 555-1234",
    phoneHref: firmConfig.phoneHref ?? "tel:+18005551234",
    contactEmail: firmConfig.contactEmail ?? null, // optional — adds email line under phone
    welcomeMessage: firmConfig.welcomeMessage ?? null, // null → use default copy
    customHelp: firmConfig.customHelp ?? {}, // { fieldKey: "custom hint text" }
    // Department-controlled feature flags for the intake form. PI screening
    // defaults to OFF — firms that take PI referrals turn it on from the
    // Department Settings panel. Most bankruptcy practices don't take PI,
    // so hiding by default keeps the intake focused.
    enablePersonalInjuryScreening: firmConfig.enablePersonalInjuryScreening ?? false,
    // Disclosure / consent text overrides — each firm can edit these in
    // the Department Settings panel. When null, the defaults below are
    // rendered. The default body uses {firmName} as a placeholder which
    // gets substituted with FIRM.name at render time.
    certificationText: firmConfig.certificationText ?? null,
    smsConsentText: firmConfig.smsConsentText ?? null,
  };
  // Default consent strings — used when the firm hasn't overridden them.
  // {firmName} substitution happens inline below.
  const DEFAULT_CERT_TEXT = "I certify that all information is true, correct, and complete. I understand this does not constitute legal advice or create an attorney-client relationship.";
  const DEFAULT_SMS_TEXT = `By submitting this form, I agree that {firmName} and its staff may contact me by phone call, text message (including automated and AI-assisted texts), and email at the phone number and email address I provide, to schedule and handle my intake. Message and data rates may apply. I can reply STOP at any time to opt out of texts. Consent is not a condition of receiving legal services.`;
  const renderConsent = (text) => (text ?? "").replace(/\{firmName\}/g, FIRM.name);
  const CERT_TEXT = renderConsent(FIRM.certificationText ?? DEFAULT_CERT_TEXT);
  const SMS_TEXT = renderConsent(FIRM.smsConsentText ?? DEFAULT_SMS_TEXT);
  const isStaffSession = !!staffMode;
  const isTakeover = staffMode?.mode === 'takeover';
  const [step, setStep] = useState(0);
  // Emit step transitions to the wrapper so its script panel can track us.
  useEffect(() => { if (typeof onStepChange === 'function') onStepChange(step); }, [step, onStepChange]);
  // Merge any wrapper-supplied initial values (name/email/phone/state/etc.)
  // on top of the default data state, once on mount. Defaults are populated
  // by the giant useState below; this merge runs after so initialData wins.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (initialData && typeof initialData === 'object' && Object.keys(initialData).length > 0) {
      setData(prev => ({ ...prev, ...initialData }));
    }
  }, []);
  const [started, setStarted] = useState(isStaffSession);
  const [errors, setErrors] = useState({});
  const [notApplicable, setNotApplicable] = useState({});
  const [scheduleState, setScheduleState] = useState("idle");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitRef, setSubmitRef] = useState("");
  // Honest partial-failure state — surfaced in the submit area when lead
  // creation succeeded but the submission insert didn't (per readme §4.1:
  // no fabricated success). Cleared when the user retries.
  const [submitError, setSubmitError] = useState("");
  const [appt, setAppt] = useState({ name:"", phone:"", email:"", preferredDate:"", preferredTime:"", notes:"", consultType:"phone" });
  const [piSubmitStatus, setPiSubmitStatus] = useState("idle"); // idle | submitting | submitted | error
  const topRef = useRef(null);
  const sessionId = useMemo(() => `intake_${Date.now()}_${Math.random().toString(36).slice(2)}`, []);

  const [data, setData] = useState({
    maritalStatus:"", filingType:"", firstName:"", lastName:"", email: clientEmail||"", phone: clientPhone||"", spouseFirstName:"", spouseLastName:"",
    address:"", city:"", zip:"",
    state:"", county:"", addressYears:"",
    // Mailing address — asked AFTER the residential address so the client can
    // confirm "same as where I live" with one tap and skip re-entering it.
    // If different, we collect the separate mailing address.
    mailingSameAsCurrent:"",
    mailingAddress:"", mailingCity:"", mailingState:"", mailingZip:"",
    priorDomicileState:"",
    priorAddr1Street:"", priorAddr1City:"", priorAddr1State:"", priorAddr1From:"", priorAddr1To:"",
    numDependents:"0", dependents:[], householdSizeChanged:"", householdSizeChangeDetails:"",
    // Support paid to people OUTSIDE the household (e.g., adult child in
    // college, elderly parent in their own home). Distinct from dependents
    // who live in the household. Each entry tracks relationship + monthly $.
    supportsOutsideHome:"",
    outsideSupport:[{id:1, relationship:"", monthlyAmount:""}],
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
    // Income reconciliation questions (asked after the income summary on step 2).
    // If the client's current/6-mo income don't match OR they expect a change,
    // attorney needs to know so means-test analysis can adjust forward-looking.
    incomeMatches6Mo:"",
    incomeMatchDetails:"",
    incomeFutureChange:"",
    incomeFutureChangeDetails:"",
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
    // Second-property mortgage-current + arrears — mirror of the primary's
    // mortgageCurrent/mortgageArrears so the attorney eligibility analysis
    // can factor in arrears for EVERY property the debtor wants to keep.
    secondMortgageCurrent:"", secondMortgageArrears:"",
    hasInvestmentProperty:"", hasRawLandTimeshare:"", hasNameOnOthersRealEstate:"",
    hasVehicles:"",
    vehicles:[{id:1,type:"",year:"",make:"",model:"",value:"",intent:"",hasLoan:"",loanBalance:"",monthlyPayment:"",isLease:"",purchaseDate:"",hasHandicapPlacard:"",valuationStatus:"idle",valuationResult:null,valuationError:null,valuationOverride:false,overrideReason:"",overrideDetails:"",ownershipType:"",ownedBeforeMarriage:"",maritalFundsUsed:"",hasPrenup:"",inheritedOrGift:"",communityPropFlag:false}],
    // Expense entry mode — "manual" (client types everything) or "auto"
    // (pre-fill IRS standards into the auto-fillable categories; client can
    // still tap "I don't have this" or override per line).
    expenseFillMode:"",
    // Borrowed-vehicle disclosure — regularly using someone else's car or
    // truck. Drives Schedule J "other transportation" + attorney review.
    borrowedVehicleUse:"",
    borrowedVehiclePays:"",
    borrowedVehicleAmount:"",
    borrowedVehicleDescription:"",
    noVehicles:false,
    hasBankAccounts:"",
    // Health Savings / Flexible Spending accounts — Schedule A/B disclosure.
    // HSA balances are usually NOT exempt (depending on state); FSA balances
    // generally aren't either. Both are estate assets and need to be listed.
    hasHsaFsa:"",
    hsaFsaEntries:[{ id:1, accountType:"", provider:"", balance:"" }],
    bankAccounts:[{id:1,bankName:"",accountType:"",balance:""}], noBankAccounts:false,
    hasRetirement:"",
    retirementAccounts:[{id:1, accountType:"", institution:"", balance:"", ownerName:""}], noRetirement:false,
    hasLifeInsurance:"",
    lifePolicies:[{id:1,policyType:"",faceValue:"",cashValue:"",beneficiary:"",purchaseDate:""}],
    hasAnnuities:"",
    annuities:[{id:1,annuityType:"",currentValue:"",yearsHeld:"",beneficiary:"",purchaseDate:""}],
    hasPendingClaims:"", pendingClaimsDesc:"", pendingClaimsValue:"", pendingClaimsValueUnknown:false,
    // Personal property — pending PI claims + inheritance expectations.
    // Both flagged for attorney review as red-flag issues so the case
    // analyst can verify schedule disclosures and exemption treatment.
    hasPiClaimInProperty:"",
    piClaimInPropertyDetails:"",
    expectsInheritance:"",
    inheritanceDetails:"",
    hasSsClaim:"", ssPendingDesc:"",
    hasSsBackPay:"", ssBackPayAmount:"", ssBackPaySegregated:"",
    hasMoneyOwed:"", moneyOwedDesc:"", moneyOwedAmt:"",
    // Money owed TO the client (Schedule A/B asset). Per-entry shape:
    // sourceType (loan/deposit/tax refund/etc.) + sourceDescription (who owes
    // / what for) + amount + expectsToCollect Y/N.
    moneyOwedEntries:[{ id:1, sourceType:"", sourceDescription:"", amount:"", expectsToCollect:"" }],
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

    // Recreational / titled vehicles separate from primary vehicles — motorcycles,
    // quads/ATVs, boats, jet skis, travel trailers, planes, RVs, snowmobiles, etc.
    // Each entry mirrors the vehicle shape (type/make/model/value + loan) so any
    // financed item auto-flows into Schedule D and into Schedule J transportation.
    hasRecreationalVehicles:"",
    recreationalVehicles:[{id:1, type:"", make:"", model:"", year:"", value:"", hasLoan:"", lenderName:"", loanBalance:"", monthlyPayment:"", intent:"keep"}],

    mortgageCurrent:"", mortgageArrears:"",
    securedDebt:"", hasMortgage:"",
    // Other secured creditors not already disclosed via mortgages / vehicles /
    // recreational vehicles. Surfaced on Schedule D after the auto-pulled list,
    // gated on `securedListComplete === "no"`.
    securedListComplete:"",
    hasOtherVehicleLoans:"",
    // collateralAssetKey links to a previously-disclosed asset (e.g.,
    // "realProperty1", "vehicle:3", "rv:1", "category:household_goods").
    // When = "other" the client describes new property via collateralDescription.
    otherSecuredCreditors:[{id:1, creditorName:"", collateralAssetKey:"", collateralDescription:"", balance:"", monthlyPayment:""}],
    creditCardDebt:"", medicalDebt:"", studentLoanDebt:"", taxDebt:"",
    personalLoanDebt:"", judgmentDebt:"", otherUnsecured:"",
    childSupportCurrent:"", childSupportArrears:"", noChildSupportArrears:false,
    alimonyCurrent:"", alimonyArrears:"", noAlimonyArrears:false,
    noCreditCardDebt:false, noMedicalDebt:false, noStudentLoanDebt:false, noTaxDebt:false,
    noPersonalLoanDebt:false, noJudgmentDebt:false, noOtherUnsecured:false,
    // Priority debts (Schedule E) — back taxes, back child support, back alimony.
    // Source of truth for new entries is priorityDebts[]; legacy seeds may still
    // populate the flat taxDebt / childSupportArrears / alimonyArrears fields
    // and the attorney-side analyzer reads both paths.
    hasPriorityDebt:"",
    // paymentMethod = "direct" | "paycheck" | "both" | "none" — drives Schedule J
    // de-duplication. Paycheck-deducted payments don't appear as Schedule J
    // expenses (the deduction already shows on the paystub against gross income).
    priorityDebts:[{ id:1, type:"", creditor:"", amount:"", balance:"", taxYear:"", taxFiled:"", monthlyPayment:"", paymentMethod:"" }],
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
    // Secured creditor 90-day payment confirmation — auto-pulled from
    // mortgages / vehicles / recreational vehicles with monthly payment ≥ $600.
    // Keyed by creditor reference (e.g., "primary_mortgage", "vehicle:0"); each
    // entry tracks whether the client paid the expected amount over the last
    // 90 days and what the actual amount was if not.
    securedPaymentConfirmations:{},
    // Catch-all — any OTHER creditor paid over $600 in 90 days that wasn't
    // already auto-listed from secured creditors.
    otherCreditorPaymentsOver600:"",
    otherCreditorPaymentsList:[{ id:1, creditor:"", amount:"", date:"" }],
    // SOFA — property stored / held by someone else.
    propertyStoredElsewhere:"",
    storedPropertyEntries:[{ id:1, locationType:"", locationDetails:"", items:"", value:"" }],
    // SOFA Part 9 — does the client hold property that belongs to someone
    // else? (reverse of "property stored elsewhere"). Per-entry tracks who
    // owns it + a description of the item(s).
    holdsPropertyForOther:"",
    propertyHeldForOtherEntries:[{ id:1, ownerName:"", description:"" }],
    preferentialPaymentsInsider:"",
    preferentialInsiderEntries:[{id:1, creditor:"", amount:"", date:"", relationship:"", dateConfirmedRecent:"", dateIsOld:""}],
    createdTrust:"", trustDetails:"",
    // Structured trust disclosure — replaces / supplements trustDetails.
    // Each trust entry captures name + transfer + trustee + beneficiary
    // + revocable/irrevocable so the attorney has everything needed for
    // § 548 fraudulent-transfer + § 541 estate-inclusion analysis.
    trustEntries:[{ id:1, trustName:"", propertyTransferred:"", propertyValue:"", trusteeName:"", beneficiaryName:"", trustType:"" }],
    pendingLawsuits:"", lawsuitDetails:"",
    // Lawsuit entries — replaces the single free-text lawsuitDetails field
    // (kept above for back-compat with older submissions). Each entry asks
    // who is suing the client and what the suit is about.
    lawsuitEntries:[{ id:1, plaintiff:"", suitType:"", suitTypeOther:"", claimValue:"", claimValueUnknown:false, details:"" }],
    // Friends / family debt — Schedule F entries owed to people close to
    // the client. Each entry also tracks "paid in last 12 months" so the
    // SOFA insider-preference section can pull from the same answers.
    hasFriendsFamilyDebt:"",
    friendsFamilyDebtEntries:[{ id:1, name:"", relationship:"", amountOwed:"", paidLast12Months:"" }],
    ownedBusiness:"", businessDetails:"",
    // Structured business disclosure — supplements free-text businessDetails
    // for back-compat. Each entry: business name + entity type + state of
    // incorporation. Multiple businesses supported.
    businessEntries:[{ id:1, businessName:"", entityType:"", stateOfIncorporation:"" }],
    expectedRefund:"", refundAmount:"",
    dsoObligation:"", dsoAmount:"",
    recentLuxury:"", luxuryDetails:"",
    garnishment:"",
    garnishmentCreditor:"",
    garnishmentMonthlyAmount:"",
    foreclosurePending:"",
    foreclosureDate:"",
    // Tax filing status — SOFA/eligibility gate. Bankruptcy requires the
    // most recent tax returns be filed (§ 1308 in Ch.13; § 521(e)(2)(A) for
    // Ch.7 requires the most recent return). If any missing, flag for the
    // attorney to chase down. "Not required" exempts clients with no
    // income / SS-only / similar.
    hasFiledAllTaxReturns:"",
    unfiledTaxYears:"",
    notRequiredToFile:"",
    notRequiredReason:"",
    notRequiredOtherDetails:"",
    confirmedMustFileBeforeFiling:false,
    // SOFA — losses to fire, theft, or gambling within the lookback period.
    // Each entry: type, date, amount. Surfaces on the SOFA disclosure schedule.
    hasLosses:"",
    lossEntries:[{ id:1, type:"", lossDate:"", amount:"", description:"" }],
    confirmedAccurate: false,
    readInfoSheet: false,
    smsEmailConsent: false,
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
      // Income reconciliation
      req("incomeMatches6Mo","Please answer whether your income matches the last 6 months");
      if (data.incomeMatches6Mo === "no" && (!data.incomeMatchDetails || !String(data.incomeMatchDetails).trim())) {
        errs["incomeMatchDetails"] = "Please explain what's different";
      }
      req("incomeFutureChange","Please answer whether your income is expected to change");
      if ((data.incomeFutureChange === "up" || data.incomeFutureChange === "down") && (!data.incomeFutureChangeDetails || !String(data.incomeFutureChangeDetails).trim())) {
        errs["incomeFutureChangeDetails"] = "Please explain what's changing";
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
      req("hasHsaFsa","Please answer yes or no");
      if (data.hasHsaFsa === "yes") {
        (data.hsaFsaEntries || []).forEach((acc, i) => {
          if (!acc.accountType) errs[`hsafsa_${i}_accountType`] = "Please pick a type";
          if (!acc.provider || !String(acc.provider).trim()) errs[`hsafsa_${i}_provider`] = "Please enter the provider";
          if (acc.balance === "" || acc.balance === undefined) errs[`hsafsa_${i}_balance`] = "Please enter the balance (or 0)";
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
      if (data.hasPendingClaims === "yes") {
        if (!data.pendingClaimsValueUnknown && (!data.pendingClaimsValue || parseFloat(data.pendingClaimsValue) <= 0)) {
          errs["pendingClaimsValue"] = "Enter the dollar amount or click Unknown";
        }
        if (!data.pendingClaimsDesc || !String(data.pendingClaimsDesc).trim()) errs["pendingClaimsDesc"] = "Please describe the claim";
      }
      req("hasPiClaimInProperty","Please answer yes or no");
      if (data.hasPiClaimInProperty==="yes") { req("piClaimInPropertyDetails","Please describe the personal injury claim"); }
      req("expectsInheritance","Please answer yes or no");
      if (data.expectsInheritance==="yes") { req("inheritanceDetails","Please describe what you expect to receive"); }
      req("hasSsClaim","Please answer yes or no");
      req("hasMoneyOwed","Please answer yes or no");
      if (data.hasMoneyOwed === "yes") {
        (data.moneyOwedEntries || []).forEach((mo, i) => {
          if (!mo.sourceType) errs[`moneyOwed_${i}_sourceType`] = "Please pick a type";
          if (!mo.sourceDescription || !String(mo.sourceDescription).trim()) errs[`moneyOwed_${i}_sourceDescription`] = "Please describe who owes you and why";
          if (!mo.amount || parseFloat(mo.amount) <= 0) errs[`moneyOwed_${i}_amount`] = "Please enter the amount";
          if (!mo.expectsToCollect) errs[`moneyOwed_${i}_expectsToCollect`] = "Please answer whether you expect to collect";
        });
      }
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
      req("securedListComplete","Please confirm whether the secured creditor list is complete");
      req("hasOtherVehicleLoans","Please indicate whether you have other vehicle loans");
      if (data.securedListComplete === "no") {
        (data.otherSecuredCreditors || []).forEach((sc, i) => {
          if (!sc.creditorName || !String(sc.creditorName).trim()) errs[`otherSec_${i}_creditorName`] = "Creditor name is required";
          if (!sc.collateralAssetKey) errs[`otherSec_${i}_collateralAssetKey`] = "Please pick what the lien is on";
          if (sc.collateralAssetKey === "other" && (!sc.collateralDescription || !String(sc.collateralDescription).trim())) {
            errs[`otherSec_${i}_collateralDescription`] = "Please describe the property";
          }
          if (!sc.balance || parseFloat(sc.balance) <= 0) errs[`otherSec_${i}_balance`] = "Balance is required";
        });
      }
      req("hasPriorityDebt","Please indicate whether you have any priority debts (back taxes, back child support, back alimony)");
      if (data.hasPriorityDebt === "yes") {
        (data.priorityDebts || []).forEach((d,i)=>{
          if (!d.type) errs[`priority_${i}_type`] = "Please select a type";
          if (d.type === "back_taxes") {
            if (!d.taxYear || !String(d.taxYear).trim()) errs[`priority_${i}_taxYear`] = "Tax year is required";
            if (!d.amount || parseFloat(d.amount) <= 0) errs[`priority_${i}_amount`] = "Amount owed is required";
            if (!d.taxFiled) errs[`priority_${i}_taxFiled`] = "Please confirm whether the tax return was filed";
          }
          if (d.type === "back_child_support" || d.type === "back_alimony") {
            if (!d.amount || parseFloat(d.amount) <= 0) errs[`priority_${i}_amount`] = "Total past-due amount is required";
            if (!d.monthlyPayment) errs[`priority_${i}_monthlyPayment`] = "Monthly payment is required";
          }
          // If there's a monthly payment, require the payment method (drives Schedule J de-dup)
          if (d.type && parseFloat(d.monthlyPayment) > 0 && !d.paymentMethod) {
            errs[`priority_${i}_paymentMethod`] = "Please indicate how this payment is made (direct, paycheck, or both)";
          }
        });
      }
      req("hasBusinessDebt","Please indicate whether you have any business debts");
      ["creditCardDebt","medicalDebt","studentLoanDebt","personalLoanDebt","judgmentDebt","otherUnsecured"].forEach(f=>reqN(f));
      req("hasFriendsFamilyDebt","Please answer yes or no");
      if (data.hasFriendsFamilyDebt === "yes") {
        (data.friendsFamilyDebtEntries || []).forEach((ff, i) => {
          if (!ff.name || !String(ff.name).trim()) errs[`ff_${i}_name`] = "Please enter the name";
          if (!ff.relationship || !String(ff.relationship).trim()) errs[`ff_${i}_relationship`] = "Please enter the relationship";
          if (!ff.amountOwed || parseFloat(ff.amountOwed) <= 0) errs[`ff_${i}_amountOwed`] = "Please enter the amount owed";
          if (ff.paidLast12Months === "" || ff.paidLast12Months === undefined) errs[`ff_${i}_paidLast12Months`] = "Please enter the amount paid in the last 12 months (or 0)";
        });
      }
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
      if (data.createdTrust === "yes") {
        (data.trustEntries || []).forEach((t, i) => {
          if (!t.trustName || !String(t.trustName).trim()) errs[`trust_${i}_trustName`] = "Please enter the trust name";
          if (!t.propertyTransferred || !String(t.propertyTransferred).trim()) errs[`trust_${i}_propertyTransferred`] = "Please describe the property transferred";
          if (!t.propertyValue || parseFloat(t.propertyValue) <= 0) errs[`trust_${i}_propertyValue`] = "Please enter the value";
          if (!t.trusteeName || !String(t.trusteeName).trim()) errs[`trust_${i}_trusteeName`] = "Please enter the trustee's name";
          if (!t.beneficiaryName || !String(t.beneficiaryName).trim()) errs[`trust_${i}_beneficiaryName`] = "Please enter the beneficiary's name";
          if (!t.trustType) errs[`trust_${i}_trustType`] = "Please pick revocable or irrevocable";
        });
      }
      req("transferredProperty","Please answer yes or no");
      req("preferentialPayments","Please answer yes or no");
      req("preferentialPaymentsInsider","Please answer yes or no");
      req("pendingLawsuits","Please answer yes or no");
      if (data.pendingLawsuits==="yes") {
        (data.lawsuitEntries || []).forEach((ls, i) => {
          if (!ls.plaintiff || !String(ls.plaintiff).trim()) errs[`lawsuit_${i}_plaintiff`] = "Please enter who is suing you";
          if (!ls.suitType) errs[`lawsuit_${i}_suitType`] = "Please pick a type";
          if (ls.suitType === "other" && (!ls.suitTypeOther || !String(ls.suitTypeOther).trim())) errs[`lawsuit_${i}_suitTypeOther`] = "Please add details";
          if (!ls.claimValueUnknown && (!ls.claimValue || parseFloat(ls.claimValue) <= 0)) {
            errs[`lawsuit_${i}_claimValue`] = "Enter the dollar amount or click Unknown";
          }
          if (!ls.details || !String(ls.details).trim()) errs[`lawsuit_${i}_details`] = "Please add details";
        });
      }
      req("ownedBusiness","Please answer yes or no");
      if (data.ownedBusiness === "yes") {
        (data.businessEntries || []).forEach((biz, i) => {
          if (!biz.businessName || !String(biz.businessName).trim()) errs[`biz_${i}_businessName`] = "Please enter the business name";
          if (!biz.entityType) errs[`biz_${i}_entityType`] = "Please pick an entity type";
          if (!biz.stateOfIncorporation) errs[`biz_${i}_stateOfIncorporation`] = "Please pick a state";
        });
      }
      req("hasFiledAllTaxReturns","Please answer about your tax filings");
      if (data.hasFiledAllTaxReturns === "no") {
        if (!data.unfiledTaxYears || !String(data.unfiledTaxYears).trim()) errs["unfiledTaxYears"] = "Please list the unfiled tax year(s)";
        if (!data.confirmedMustFileBeforeFiling) errs["confirmedMustFileBeforeFiling"] = "Please acknowledge you must file these returns before bankruptcy";
      }
      if (data.hasFiledAllTaxReturns === "not_required") {
        if (!data.notRequiredReason) errs["notRequiredReason"] = "Please pick a reason";
        if (data.notRequiredReason === "other" && (!data.notRequiredOtherDetails || !String(data.notRequiredOtherDetails).trim())) {
          errs["notRequiredOtherDetails"] = "Please explain your situation";
        }
      }
      req("propertyStoredElsewhere","Please answer yes or no");
      if (data.propertyStoredElsewhere === "yes") {
        (data.storedPropertyEntries || []).forEach((sp, i) => {
          if (!sp.locationType) errs[`storedProperty_${i}_locationType`] = "Please pick a location type";
          if (!sp.items || !String(sp.items).trim()) errs[`storedProperty_${i}_items`] = "Please describe the items";
        });
      }
      req("holdsPropertyForOther","Please answer yes or no");
      if (data.holdsPropertyForOther === "yes") {
        (data.propertyHeldForOtherEntries || []).forEach((ph, i) => {
          if (!ph.ownerName || !String(ph.ownerName).trim()) errs[`heldFor_${i}_ownerName`] = "Please enter who you hold it for";
          if (!ph.description || !String(ph.description).trim()) errs[`heldFor_${i}_description`] = "Please describe the property";
        });
      }
      req("recentLuxury","Please answer yes or no");
      req("garnishment","Please answer yes or no");
      req("hasLosses","Please answer yes or no");
      if (data.hasLosses === "yes") {
        (data.lossEntries || []).forEach((ls, i) => {
          if (!ls.type) errs[`loss_${i}_type`] = "Please pick the type of loss";
          if (!ls.lossDate) errs[`loss_${i}_lossDate`] = "Please enter the date";
          if (!ls.amount || parseFloat(ls.amount) <= 0) errs[`loss_${i}_amount`] = "Please enter the amount";
        });
      }
    }
    if (s===8 && FIRM.enablePersonalInjuryScreening) {
      req("piHasClaim","Please answer yes or no");
    }
    if (s===9) {
      if (!data.readInfoSheet) errs["readInfoSheet"]="You must read and acknowledge the Official Bankruptcy Information Sheet.";
      if (!data.confirmedAccurate) errs["confirmedAccurate"]="You must confirm the information is accurate before proceeding.";
      if (!data.smsEmailConsent) errs["smsEmailConsent"]="You must agree to be contacted before submitting your intake.";
    }
    return errs;
  };

  const handleContinue = () => {
    const errs = validateStep(step);
    setErrors(errs);
    // Skip the PI screening step (8) when the firm has it toggled off.
    setStep(s => {
      const next = s + 1;
      if (next === 8 && !FIRM.enablePersonalInjuryScreening) return 9;
      return next;
    });
    topRef.current?.scrollIntoView({behavior:"smooth"});
  };

  const submitIntake = async () => {
    setSubmitting(true);
    setSubmitError("");
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
      // Each entry carries the arrears values so the attorney dashboard's
      // Ch.7/Ch.13 analysis can factor arrears into the plan-funding total
      // (analyzeChapter7 warns "Ch.7 does not cure arrears"; analyzeChapter13
      // adds them to the cure pool over the plan term). Without these,
      // arrears would silently drop on the way into the eligibility engine.
      const real_properties = [];
      if (data.ownsRealEstate === "yes") {
        real_properties.push({
          address:       data.realPropAddress  || "",
          type:          data.realPropType     || "",
          value:         n(data.realPropValue),
          mortgageBalance: n(data.mortgageBalance),
          monthlyPayment:  n(data.realPropMonthlyPayment),
          arrearsAmount:   n(data.mortgageArrears),
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
          arrearsAmount:   n(data.secondMortgageArrears),
          isCurrent:       data.secondMortgageCurrent || "",
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

      // Submission payload — passed to the canonical intake helper
      // (src/lib/createLead.ts) which seeds an `intake_leads` row FIRST
      // and inserts this submission with `lead_id` set, fixing the prior
      // orphan-submission problem (matter spine starts at step 1).
      //
      // `submitted_at` and `lead_id` are intentionally omitted here — the
      // helper sets them so callers can't accidentally write an orphan.
      const submissionPayload = {
        reference_number: ref,
        client_id:        clientId ?? null,
        status:           "pending_review",

        // Dual-write: full camelCase intake state for the attorney review
        // portal + questionnaire prefill. Flat columns below remain for
        // legacy callers; BAN-40 phase 2 will collapse to form_data only.
        form_data:        data,

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

        // SMS / email consent — captured at submit time, never auto-set.
        // Form validation prevents submission unless data.smsEmailConsent === true.
        sms_email_consent: data.smsEmailConsent === true,
        sms_email_consent_at: data.smsEmailConsent === true ? new Date().toISOString() : null,

      };

      // Two paths converge on `submissionId`:
      //   - leadId provided (staff-guided wrapper) → insert directly with
      //     the wrapper's existing lead_id.
      //   - leadId null (public route) → use createLeadAndSubmission to
      //     atomically create the lead + submission via channel
      //     'agent_assisted' (staff-guided form, mounted from the Intake
      //     portal). Honest partial-failure UI when the lead succeeds
      //     but the submission insert doesn't.
      let submissionId = null;
      if (leadId) {
        const { data: submission } = await supabase
          .from("intake_submissions")
          .insert({
            ...submissionPayload,
            lead_id:      leadId,
            submitted_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        submissionId = submission?.id ?? null;
      } else {
        const result = await createLeadAndSubmission({
          channel:  "agent_assisted",
          fullName: `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim() || null,
          email:    data.email || null,
          phone:    data.phone || null,
          submission: submissionPayload,
        });
        if (!result.ok) {
          setSubmitError("There was a problem submitting your form. Please try again or contact our office directly.");
          setSubmitting(false);
          return;
        }
        if (!result.submissionId) {
          // Honest partial — lead recorded, full submission didn't. Do
          // NOT advance to the success screen.
          setSubmitError("We've got your contact info, but the full intake didn't save. Please retry, or our office will follow up.");
          setSubmitting(false);
          return;
        }
        submissionId = result.submissionId;
      }

      if (clientId && submissionId) {
        await supabase.from("clients").update({
          intake_id: submissionId,
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
          intake_id: submissionId,
          reference_number: ref,
          status: "pending_contact",
          notified_at: new Date().toISOString(),
        });
      }
      if (submissionId) {
        await supabase.from("intake_chats")
          .update({ draft_id: submissionId })
          .eq("session_id", sessionId)
          .is("draft_id", null);
      }
      setSubmitRef(ref);
      setSubmitted(true);
      // Notify wrapper (StaffGuidedIntake) that submission completed so it
      // can advance the lead row. No-op for the public route.
      if (typeof onSubmitted === 'function') onSubmitted(submissionId);
    } catch(err) {
      const ref = "BAI-" + Date.now().toString(36).toUpperCase();
      setSubmitRef(ref);
      setSubmitted(true);
      if (typeof onSubmitted === 'function') onSubmitted(null);
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
          <div className="mb-4 p-5 bg-slate-800/60 border border-slate-600 rounded-xl">
            <p className="text-base text-white font-bold leading-relaxed">
              We need your <strong className="text-amber-400">basic contact info</strong> and <strong className="text-amber-400">marital status</strong> to set up your case.
            </p>
            <p className="text-base text-white font-bold leading-relaxed mt-2">
              If your spouse doesn't want to file, pick <strong className="text-amber-400">"married and my spouse is not filing with me"</strong>.
            </p>
            <p className="text-base text-white font-bold leading-relaxed mt-2">
              Spouse info is still needed if you live in a <strong className="text-amber-400">community property state</strong>.
            </p>
            <p className="text-base text-amber-400 font-bold leading-relaxed mt-2">
              Everything you share is strictly confidential.
            </p>
          </div>
          <SectionCard title="" icon="">
            <p className="text-base font-semibold text-white mb-2">Are you married, single, divorced, separated, or widowed?</p>
            <Field label="Pick your current marital status:" error={e("maritalStatus")}>
              <RadioGroup name="maritalStatus" current={data.maritalStatus} onChange={v=>{
                u("maritalStatus",v);
                if (v==="single" || v==="divorced" || v==="widowed") u("filingType","individual");
                else if (v==="separated") u("filingType","individual");
                else u("filingType","");
              }} error={e("maritalStatus")}
                options={[
                  {value:"single",    label:"Single — I'm not married"},
                  {value:"married",   label:"Married"},
                  {value:"separated", label:"Legally separated from my spouse"},
                  {value:"divorced",  label:"Divorced"},
                  {value:"widowed",   label:"Widowed"},
                ]}/>
            </Field>
            {data.maritalStatus && data.maritalStatus !== "single" && data.maritalStatus !== "married" && (
              <div className="mt-2 p-3 bg-slate-700/50 rounded-lg">
                <p className="text-xs text-slate-400 leading-relaxed">
                  {data.maritalStatus === "separated"
                    ? "Got it. Being legally separated can change how property gets handled. Your attorney will look at your separation paperwork."
                    : data.maritalStatus === "divorced"
                    ? "Got it. If your divorce is already final, you'll file by yourself. Please have your divorce paperwork ready for your attorney."
                    : "Got it. Widowed clients file by themselves. If your spouse passed away in the last 2 years, your attorney will check if any joint filing rules still apply."}
                </p>
              </div>
            )}

            {data.maritalStatus==="married" && (
              <Field label="Are you and your spouse filing together, or just you?" error={e("filingType")}>
                <RadioGroup name="filingType" current={data.filingType} onChange={v=>u("filingType",v)} error={e("filingType")}
                  options={[{value:"joint",label:"Both of us are filing together"},{value:"individual-nonfiling-spouse",label:"Just me — my spouse isn't filing"}]}/>
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
                        <p className="text-xs font-semibold text-amber-400 mb-1">Non-filing spouse notice</p>
                        <p className="text-xs text-amber-200/70 leading-relaxed">
                          {data.state ? `${data.state} is not a community property state. However, your` : "Depending on your state, your"} non-filing spouse's income is still required for the means test. If you reside in a community property state (Arizona, California, Idaho, Louisiana, Nevada, New Mexico, Texas, Washington, or Wisconsin), you will also be required to disclose all community property assets and interests. Your attorney will advise on full disclosure requirements.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            <p className="text-base font-semibold text-white mb-2 mt-4">What's your name and how can we reach you?</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="What's your first name?" error={e("firstName")}><Input value={data.firstName} onChange={v=>u("firstName",v)} placeholder="First" hasError={!!e("firstName")}/></Field>
              <Field label="What's your last name?" error={e("lastName")}><Input value={data.lastName} onChange={v=>u("lastName",v)} placeholder="Last" hasError={!!e("lastName")}/></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="What's your email address?" error={e("email")}><Input type="email" value={data.email} onChange={v=>u("email",v)} placeholder="your@email.com" hasError={!!e("email")}/></Field>
              <Field label="What's your phone number?" error={e("phone")}><Input type="tel" value={data.phone} onChange={v=>u("phone",v)} placeholder="(555) 555-5555" hasError={!!e("phone")}/></Field>
            </div>
            {(data.filingType==="joint"||data.filingType==="individual-nonfiling-spouse") && <>
              <p className="text-base font-semibold text-white mb-2 mt-3">{data.filingType==="joint"?"Now your spouse's name (you're filing together):":"Now your spouse's name (they aren't filing):"}</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Spouse's first name" error={e("spouseFirstName")}><Input value={data.spouseFirstName} onChange={v=>u("spouseFirstName",v)} placeholder="First" hasError={!!e("spouseFirstName")}/></Field>
                <Field label="Spouse's last name" error={e("spouseLastName")}><Input value={data.spouseLastName} onChange={v=>u("spouseLastName",v)} placeholder="Last" hasError={!!e("spouseLastName")}/></Field>
              </div>
            </>}
          </SectionCard>
          <SectionCard title="Current Address" icon="🏠">
            <p className="text-base font-semibold text-white mb-2">Where do you currently live?</p>
            <p className="text-xs text-slate-400 mb-3">This is the address where you sleep most nights — your home. We'll ask about your mailing address next.</p>
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
            <Field label="What state do you live in?" error={e("state")}>
              <Select value={data.state} onChange={v=>{u("state",v);u("county","");}} options={US_STATES} placeholder="Select state..." hasError={!!e("state")}/>
            </Field>
            <Field label="What county do you live in?" error={e("county")}>
              {COUNTIES_BY_STATE[data.state]
                ? <Select value={data.county} onChange={v=>u("county",v)} options={COUNTIES_BY_STATE[data.state]} placeholder="Select county..." hasError={!!e("county")}/>
                : <Input value={data.county} onChange={v=>u("county",v)} placeholder={data.state?"Enter county name":"Pick a state first"} hasError={!!e("county")}/>}
            </Field>

            {/* Mailing address question — asked BEFORE how-long-at-address per
                client spec. If same, we skip collecting a second address. */}
            <Field label="Is your mailing address the same as the address above?" error={e("mailingSameAsCurrent")}>
              <RadioGroup name="mailingSameAsCurrent" current={data.mailingSameAsCurrent}
                onChange={v=>u("mailingSameAsCurrent",v)} error={e("mailingSameAsCurrent")}
                options={[
                  {value:"yes",label:"Yes — my mail comes to the same address"},
                  {value:"no",label:"No — I get my mail at a different address (like a P.O. Box)"},
                ]}/>
            </Field>
            {data.mailingSameAsCurrent === "no" && (
              <div className="mb-3 p-3 bg-slate-800/40 border border-slate-700 rounded-xl">
                <p className="text-[11px] text-slate-400 mb-2">Where should we send your mail?</p>
                <Field label="Mailing Street Address (or P.O. Box)">
                  <Input value={data.mailingAddress} onChange={v=>u("mailingAddress",v)} placeholder="P.O. Box 1234 or 456 Other Street"/>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="City">
                    <Input value={data.mailingCity} onChange={v=>u("mailingCity",v)} placeholder="City"/>
                  </Field>
                  <Field label="ZIP Code">
                    <Input value={data.mailingZip} onChange={v=>u("mailingZip",v)} placeholder="85001"/>
                  </Field>
                </div>
                <Field label="State">
                  <Select value={data.mailingState} onChange={v=>u("mailingState",v)} options={US_STATES} placeholder="Select state..."/>
                </Field>
              </div>
            )}

            <Field label="How long have you lived at the address above?" error={e("addressYears")}>
              <Select value={data.addressYears} onChange={v=>u("addressYears",v)} hasError={!!e("addressYears")}
                options={["Less than 91 days","91 days – 6 months","6 months – 2 years","2+ years"]} placeholder="Pick one..."/>
            </Field>
            {data.addressYears==="Less than 91 days" && <p className="text-amber-400 text-xs mt-1">⚠️ Because you haven't lived here long, we may need to ask about your old state.</p>}
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
          {/* Exemption preview HIDDEN from the client-facing intake form per
              firm spec — the client shouldn't see which state's exemptions
              apply during intake; that's an attorney-side determination
              surfaced in the attorney review surfaces. The card itself is
              still exported for any internal surface that wants to mount it. */}
          {false && data.addressYears && <ExemptionPreviewCard data={data} />}
          <ErrorBanner errors={errors}/>
        </div>
      );

      case 1: return (
        <div>
          <div className="mb-4 p-5 bg-slate-800/60 border border-slate-600 rounded-xl">
            <p className="text-base text-white font-bold leading-relaxed">
              We use your <strong className="text-amber-400">Household Size</strong> for the <strong className="text-amber-400">Means Test</strong> — the income check required by federal bankruptcy law. The number of people in your home decides the income threshold your attorney compares against.
            </p>
            <p className="text-base text-amber-400 font-bold leading-relaxed mt-3">
              Count everyone who lives in your home and depends on you financially.
            </p>
          </div>
          <SectionCard title="" icon="">
            <p className="text-base font-semibold text-white mb-2">Do you have any children or other dependents who live with you?</p>
            <p className="text-xs text-slate-400 mb-3">A dependent is anyone you take care of financially — kids, an elderly parent, a family member who lives in your home. Pick how many.</p>
            <Field label="How many dependents live with you?" hint="Children or other people you support financially">
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
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Person {i+1}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="How old are they?" error={errors[`dep_${i}_age`]}>
                        <Select value={dep.age} onChange={v=>{
                          const arr=[...data.dependents];
                          arr[i]={...arr[i],age:v};
                          setData(d=>({...d,dependents:arr}));
                        }} hasError={!!errors[`dep_${i}_age`]}
                        options={["Under 1","1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","20","21","22","23","24","25","26","27","28","29","30","31","32","33","34","35","36","37","38","39","40","41","42","43","44","45","46","47","48","49","50","51","52","53","54","55","56","57","58","59","60","61","62","63","64","65","66","67","68","69","70","71","72","73","74","75","76","77","78","79","80","81","82","83","84","85","86","87","88","89","90","91","92","93","94","95+"]}
                        placeholder="Pick an age..."/>
                      </Field>
                      <Field label="How are they related to you?" error={errors[`dep_${i}_relationship`]}>
                        <Select value={dep.relationship} onChange={v=>{
                          const arr=[...data.dependents];
                          arr[i]={...arr[i],relationship:v};
                          setData(d=>({...d,dependents:arr}));
                        }} hasError={!!errors[`dep_${i}_relationship`]}
                        options={["Son","Daughter","Stepson","Stepdaughter","Grandson","Granddaughter","Mother","Father","Stepmother","Stepfather","Grandmother","Grandfather","Sister","Brother","Aunt","Uncle","Niece","Nephew","Significant Other","Friend","Other"]}
                        placeholder="Pick a relationship..."/>
                      </Field>
                    </div>
                    <div className="mt-3">
                      <Field label="Does this person live in your home with you right now?" error={errors[`dep_${i}_stillLivesHere`]}>
                        <RadioGroup name={`dep_${i}_stillLivesHere`} current={dep.stillLivesHere} onChange={v=>{
                          const arr=[...data.dependents]; arr[i]={...arr[i],stillLivesHere:v}; setData(d=>({...d,dependents:arr}));
                        }} error={errors[`dep_${i}_stillLivesHere`]}
                          options={[{value:"yes",label:"Yes — they live with me"},{value:"no",label:"No — they live somewhere else"}]}/>
                      </Field>
                    </div>
                    <div className="mt-3">
                      <Field label="Does this person help pay any of the home's bills?" error={errors[`dep_${i}_contributesFinancially`]}>
                        <RadioGroup name={`dep_${i}_contributesFinancially`} current={dep.contributesFinancially} onChange={v=>{
                          const arr=[...data.dependents]; arr[i]={...arr[i],contributesFinancially:v, monthlyContribution: v==="no"?"":arr[i].monthlyContribution}; setData(d=>({...d,dependents:arr}));
                        }} error={errors[`dep_${i}_contributesFinancially`]}
                          options={[{value:"yes",label:"Yes — they give money toward rent, food, or other bills"},{value:"no",label:"No — they don't help pay any bills"}]}/>
                      </Field>
                      {dep.contributesFinancially==="yes" && (
                        <Field label="How much do they give each month?" error={errors[`dep_${i}_monthlyContribution`]}>
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

            {/* Support paid OUTSIDE the household — separate from dependents
                because these people don't live with the client (e.g., adult
                child away at college, elderly parent in own home, ex-spouse). */}
            <div className="mt-4 pt-4 border-t border-slate-700/60">
              <p className="text-base font-semibold text-white mb-2">Do you give money each month to anyone who does NOT live with you?</p>
              <p className="text-xs text-slate-400 mb-3">For example: an adult child in college, a parent in their own home, or someone else you help support. Don't include child support or alimony here — we ask about those later.</p>
              <Field label="Do you support anyone outside your home?" error={e("supportsOutsideHome")}>
                <RadioGroup name="supportsOutsideHome" current={data.supportsOutsideHome}
                  onChange={v=>u("supportsOutsideHome",v)} error={e("supportsOutsideHome")}
                  options={[
                    {value:"yes",label:"Yes — I give money to someone outside my home"},
                    {value:"no",label:"No — I don't support anyone outside my home"},
                  ]}/>
              </Field>
              {data.supportsOutsideHome === "yes" && (
                <div className="mt-2 space-y-2">
                  {(data.outsideSupport || []).map((os, i) => (
                    <div key={os.id} className="bg-slate-900/60 border border-slate-600 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Person {i+1}</p>
                        {(data.outsideSupport || []).length > 1 && (
                          <button type="button"
                            onClick={()=>u("outsideSupport", data.outsideSupport.filter(x => x.id !== os.id))}
                            className="text-xs text-red-400 hover:text-red-300 underline">Remove</button>
                        )}
                      </div>
                      <Field label="How are they related to you?" error={errors[`outsideSupport_${i}_relationship`]}>
                        <Select value={os.relationship}
                          onChange={v=>u("outsideSupport", data.outsideSupport.map((x,idx)=>idx===i?{...x,relationship:v}:x))}
                          hasError={!!errors[`outsideSupport_${i}_relationship`]}
                          options={["Son","Daughter","Stepson","Stepdaughter","Grandson","Granddaughter","Mother","Father","Stepmother","Stepfather","Grandmother","Grandfather","Sister","Brother","Aunt","Uncle","Niece","Nephew","Significant Other","Friend","Other"]}
                          placeholder="Pick a relationship..."/>
                      </Field>
                      <Field label="How much do you send them each month?" error={errors[`outsideSupport_${i}_monthlyAmount`]}>
                        <Input type="number" value={os.monthlyAmount}
                          onChange={v=>u("outsideSupport", data.outsideSupport.map((x,idx)=>idx===i?{...x,monthlyAmount:v}:x))}
                          placeholder="e.g. 300" hasError={!!errors[`outsideSupport_${i}_monthlyAmount`]}/>
                      </Field>
                    </div>
                  ))}
                  <button type="button"
                    onClick={()=>u("outsideSupport", [...(data.outsideSupport || []), { id: Date.now(), relationship:"", monthlyAmount:"" }])}
                    className="w-full border border-dashed border-amber-400/40 hover:border-amber-400 text-amber-400 text-xs font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2">
                    <span className="text-base">+</span> Add Another Person
                  </button>
                </div>
              )}
            </div>

            <div className="mt-3 p-3 bg-slate-700/50 rounded-lg">
              <p className="text-xs text-slate-400">Household size we'll use to calculate the means test:</p>
              <p className="text-xl font-serif text-amber-400 font-bold">{parseInt(data.numDependents||0)+(data.filingType==="joint"||data.filingType==="individual-nonfiling-spouse"?2:1)} people</p>
            </div>
          </SectionCard>
          <ErrorBanner errors={errors}/>
        </div>
      );

      case 2: {
        // Role labels — "Client 1" / "Client 2" / "Non-filing Spouse" so it's
        // clear whose info each section is asking about. The actual entered
        // first/last name (when present) is shown above the role label.
        const debtorName = data.firstName ? `${data.firstName} ${data.lastName}`.trim() : "Client 1";
        const spouseName = data.spouseFirstName
          ? `${data.spouseFirstName} ${data.spouseLastName}`.trim()
          : (data.filingType==="joint" ? "Client 2" : "Non-filing Spouse");
        const spouseRoleLabel = data.filingType==="joint" ? "Client 2" : "Non-filing Spouse";
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
            <div className="mb-4 p-5 bg-slate-800/60 border border-slate-600 rounded-xl">
              <p className="text-base text-white font-bold leading-relaxed">
                We need to look at your <strong className="text-amber-400">current monthly income</strong> and the <strong className="text-amber-400">income you received in the last 6 months</strong>.
              </p>
              <p className="text-base text-white font-bold leading-relaxed mt-2">
                This goes into the <strong className="text-amber-400">Means Test</strong> — the income check required by federal bankruptcy law that compares your income to your state's median.
              </p>
              <p className="text-base text-amber-400 font-bold leading-relaxed mt-2">
                We'll also ask if anything's expected to change soon.
              </p>
            </div>
            <PersonIncomeSection
              who="debtorSources" label="Client 1" personName={debtorName}
              workStatusKey="debtorWorkStatus" workStatus={data.debtorWorkStatus}
              sources={data.debtorSources} monthlyGrossTotal={monthlyGross()}
              onStatusChange={v=>u("debtorWorkStatus",v)} onUpdate={uSrc} onError={eSrc}
              onAdd={addSrc} onRemove={removeSrc} periodToMonthly={periodToMonthly} isSpouse={false}/>
            {hasSpouse && (
              <PersonIncomeSection
                who="spouseSources" label={spouseRoleLabel} personName={spouseName}
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
            {/* DMI / Ch.7-vs-Ch.13 eligibility comparison HIDDEN from the
                client-facing intake form per firm spec — the client
                shouldn't be shown a pre-attorney eligibility verdict.
                The block is preserved (wrapped in `{false && (...)}` below)
                so it can be reinstated for an internal surface by flipping
                the conditional. Computation helpers (ch7DMI/ch13DMI/etc.)
                still run above so any downstream consumer keeps working. */}
            {false && (
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
                    <div className="flex items-start gap-2 text-[10px] bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 text-amber-400">
                      <svg className="w-3 h-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.998L13.732 4c-.77-1.332-2.694-1.332-3.464 0L3.34 16.002c-.77 1.331.192 2.998 1.732 2.998z"/></svg>
                      <span><span className="font-bold">Presumptive Ch. 13:</span> Over median — self-employment income shown as gross (no Schedule C deductions per 11 U.S.C. § 1325(b))</span>
                    </div>
                  )}

                  {data.debtorSources.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Client 1 Income</p>
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
                          <span className="text-slate-400 font-semibold">Client 1 Subtotal</span>
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
                        {data.filingType === "individual-nonfiling-spouse" ? "Non-filing Spouse Income" : "Client 2 Income"}
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
                          <span className="text-slate-400 font-semibold">{data.filingType === "individual-nonfiling-spouse" ? "Non-filing Spouse Subtotal" : "Client 2 Subtotal"}</span>
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
            )}

            {/* Income reconciliation — asked AFTER the summary so the client
                has the figures in mind. If either answer flags a change, the
                attorney portal surfaces it for review. */}
            <SectionCard title="Does your income match what's shown?" icon="🔎">
              <Field label="Does your income look the same as what you received in the last 6 months?" error={e("incomeMatches6Mo")}>
                <RadioGroup name="incomeMatches6Mo" current={data.incomeMatches6Mo}
                  onChange={v=>u("incomeMatches6Mo",v)} error={e("incomeMatches6Mo")}
                  options={[
                    {value:"yes",label:"Yes — it looks about the same"},
                    {value:"no",label:"No — it's different from the last 6 months"},
                  ]}/>
              </Field>
              {data.incomeMatches6Mo === "no" && (
                <Field label="What's different? Please explain." error={e("incomeMatchDetails")}>
                  <textarea
                    value={data.incomeMatchDetails || ""}
                    onChange={ev=>u("incomeMatchDetails", ev.target.value)}
                    rows={3}
                    placeholder="e.g. Lost my job in March, started a new job last month, business was seasonal..."
                    className={`w-full bg-slate-900 border ${e("incomeMatchDetails")?"border-red-500":"border-slate-600"} rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 resize-none`}
                  />
                </Field>
              )}

              <Field label="Do you expect your income to go up or down in the future?" error={e("incomeFutureChange")}>
                <RadioGroup name="incomeFutureChange" current={data.incomeFutureChange}
                  onChange={v=>u("incomeFutureChange",v)} error={e("incomeFutureChange")}
                  options={[
                    {value:"no",label:"No — I expect it to stay about the same"},
                    {value:"up",label:"Yes — I expect it to go UP"},
                    {value:"down",label:"Yes — I expect it to go DOWN"},
                  ]}/>
              </Field>
              {(data.incomeFutureChange === "up" || data.incomeFutureChange === "down") && (
                <Field label="What's changing? Please explain." error={e("incomeFutureChangeDetails")}>
                  <textarea
                    value={data.incomeFutureChangeDetails || ""}
                    onChange={ev=>u("incomeFutureChangeDetails", ev.target.value)}
                    rows={3}
                    placeholder="e.g. New job starting next month, retiring at end of year, hours being cut..."
                    className={`w-full bg-slate-900 border ${e("incomeFutureChangeDetails")?"border-red-500":"border-slate-600"} rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 resize-none`}
                  />
                </Field>
              )}

              {(data.incomeMatches6Mo === "no" || data.incomeFutureChange === "up" || data.incomeFutureChange === "down") && (
                <div className="mt-2 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <p className="text-[11px] text-amber-200/95">
                    <strong className="text-amber-400">Flagged for attorney review.</strong> Because your income has changed or will change, your attorney will adjust the means-test analysis to account for what you actually expect to earn.
                  </p>
                </div>
              )}
            </SectionCard>

            <ErrorBanner errors={errors}/>
          </div>
        );
      }

      case 3: return (
        <div>
          <div className="mb-4 p-5 bg-slate-800/60 border border-slate-600 rounded-xl">
            <p className="text-sm font-bold text-amber-400 mb-4 text-center">Real Estate Section — Why It's Important</p>

            <p className="text-base text-white font-bold leading-relaxed mb-3">
              List <strong className="text-amber-400">all</strong> real estate so your attorney can protect what's yours.
            </p>

            <p className="text-base text-white font-bold leading-relaxed mb-3">
              We take the <strong className="text-amber-400">value of your property</strong> and subtract any{" "}
              <strong className="text-amber-400">liens</strong> (mortgages, judgments, tax liens) to figure out your{" "}
              <strong className="text-amber-400">equity</strong>.
            </p>

            <p className="text-base text-white font-bold leading-relaxed mb-4">
              Equity matters because we need to know if it's <strong className="text-amber-400">protected by an exemption</strong>.
              If yes — you keep the property. If not — the trustee may be able to sell it.
            </p>

            <div className="border-t border-slate-700/60 pt-3 mt-3">
              <p className="text-[11px] uppercase tracking-widest text-amber-400/80 font-bold mb-2 text-center">Quick definitions</p>
              <ul className="text-base text-white font-bold leading-relaxed space-y-1.5">
                <li>• <strong className="text-amber-400">Equity</strong> = value minus what you owe.</li>
                <li>• <strong className="text-amber-400">Exemption</strong> = legal shield that lets you keep property up to a set dollar amount.</li>
                <li>• <strong className="text-amber-400">Trustee</strong> = court official who reviews your case (in Ch. 7 may sell non-exempt items).</li>
              </ul>
            </div>

            <p className="text-base text-white font-bold leading-relaxed mt-4 text-center">Your attorney picks the exemptions for your state.</p>
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
              {/* Property-address shortcut: most filers' primary residence IS
                  the address they entered in Section 1 above. Ask yes/no
                  first; only show the free-text Property Address input when
                  the property is at a DIFFERENT location (rental, second
                  home, investment property, etc.). When "yes", auto-compose
                  the property address from data.address + city + state + zip
                  so realPropAddress stays populated for downstream consumers
                  (Zillow lookup, Schedule A/B render, etc.). */}
              {(() => {
                const composed = [data.address, data.city, data.state, data.zip].filter(Boolean).join(", ");
                const haveSection1 = composed.length > 0;
                return (
                  <Field label="Is this property at the same address you entered in Section 1?" error={e("realPropSameAsAbove")}>
                    <RadioGroup name="realPropSame" current={data.realPropSameAsAbove} onChange={v=>{
                      u("realPropSameAsAbove", v);
                      if (v === "yes") u("realPropAddress", composed);
                      if (v === "no")  u("realPropAddress", "");
                    }} error={e("realPropSameAsAbove")}
                      options={[
                        { value: "yes", label: haveSection1 ? `Yes — ${composed}` : "Yes — same as Section 1 (complete the address in Section 1 first)" },
                        { value: "no",  label: "No — different address" },
                      ]}/>
                  </Field>
                );
              })()}
              {data.realPropSameAsAbove === "no" && (
                <Field label="Property Address" error={e("realPropAddress")}>
                  <Input value={data.realPropAddress} onChange={v=>u("realPropAddress",v)} placeholder="Street, City, State ZIP" hasError={!!e("realPropAddress")}/>
                </Field>
              )}
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
                      <p className="text-xs text-amber-400 mb-3">
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
                            <p className="text-xs text-amber-400">No Zestimate found for this address. Please enter the value manually or <a href={zl.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">search Zillow directly</a>.</p>
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
                          <p className="text-xs font-semibold text-amber-400 mb-1">Value is more than 90 days old — please update</p>
                          <p className="text-xs text-amber-200/70 mb-2">Your property value was last verified over 90 days ago. Please click "Verify My Value with Zillow" above to get a current estimate, or visit <a href="https://www.zillow.com" target="_blank" rel="noopener noreferrer" className="underline text-amber-400">zillow.com</a> and update the value manually.</p>
                          <a href="https://www.zillow.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-400 transition-colors">
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
                <div className="mt-1 mb-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-400">
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
              {/* Does the mortgage include property taxes + insurance (PITI)?
                  Asked here in the Real Estate section so it sits with all
                  the other property details. The same state field is read
                  by Schedule D (auto-displayed) and Schedule J (read-only
                  chip "Confirm" — see case 5 Housing section). */}
              <Field label="Does your mortgage payment INCLUDE property taxes and homeowner's insurance?" hint="Most escrowed mortgages bundle taxes + insurance (called PITI). Check your monthly statement." error={e("mortgageIncludesInsurance")}>
                <RadioGroup name="mortgIncIns" current={data.mortgageIncludesInsurance}
                  onChange={v=>{
                    u("mortgageIncludesInsurance", v);
                    if (v === "both" || v === "taxonly") { u("expPropTax","0"); }
                    if (v === "both" || v === "insonly") { u("expInsHome","0"); }
                  }}
                  error={e("mortgageIncludesInsurance")}
                  options={[
                    {value:"both", label:"Yes — both taxes & insurance are included (full PITI)"},
                    {value:"taxonly", label:"Taxes only — I pay insurance separately"},
                    {value:"insonly", label:"Insurance only — I pay taxes separately"},
                    {value:"neither", label:"Neither — I pay taxes and insurance separately"},
                  ]}/>
              </Field>
              {/* Mortgage-current + arrears inline with each mortgage creditor.
                  Drives the attorney dashboard's Ch.7-vs-Ch.13 analysis:
                  any non-zero arrears triggers a "Ch. 7 does not cure arrears
                  — Ch. 13 may be required to save the home" warning and the
                  arrears amount is added to the Ch.13 plan funding total
                  (see AttorneyIntakeDashboard.tsx:662, 764). State shared
                  with the housing-expenses block so editing either updates
                  the other. */}
              <Field label="Are you current on this mortgage?" error={e("mortgageCurrent")}>
                <RadioGroup name="mortgCurrInProp" current={data.mortgageCurrent} onChange={v=>{
                  u("mortgageCurrent", v);
                  if (v === "yes") u("mortgageArrears", "0");
                }} error={e("mortgageCurrent")}
                  options={[{value:"yes",label:"Yes — current on all payments"},{value:"no",label:"No — behind on payments"}]}/>
              </Field>
              {data.mortgageCurrent === "no" && (
                <>
                  <Field label="How much are you behind on the mortgage?" hint="Total back payments owed. Ch.7 does NOT cure these — Ch.13 cures them over 3–5 years." error={e("mortgageArrears")}>
                    <Input type="number" value={data.mortgageArrears} onChange={v=>u("mortgageArrears", v)} placeholder="Enter amount past due" hasError={!!e("mortgageArrears")}/>
                  </Field>
                  {/* Foreclosure question — placed with the rest of the
                      real-property questions and shown only when the client
                      is behind on the mortgage (a current-paying client by
                      definition is not in foreclosure). */}
                  <Field label="Is your house being foreclosed on right now?">
                    <RadioGroup name="foreclosurePending" current={data.foreclosurePending}
                      onChange={v=>u("foreclosurePending",v)}
                      options={[{value:"yes",label:"Yes"},{value:"no",label:"No"},{value:"unknown",label:"Not sure"}]}/>
                  </Field>
                  {data.foreclosurePending==="yes" && (
                    <div className="mb-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30">
                      <p className="text-xs text-red-300 font-bold mb-2"><span className="text-red-400">⚠ URGENT</span> — Filing <strong className="text-white">before the sale date</strong> stops the foreclosure. <strong>Don't wait.</strong></p>
                      <Field label="When is the foreclosure sale date? (if you know)">
                        <Input value={data.foreclosureDate} onChange={v=>u("foreclosureDate",v)} placeholder="MM/DD/YYYY"/>
                      </Field>
                    </div>
                  )}
                </>
              )}
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
                        ? [{value:"debtor1",label:"Client 1 only"},{value:"debtor2",label:"Client 2 only"},{value:"both",label:"Owned jointly by both clients"}]
                        : data.filingType==="individual-nonfiling-spouse"
                        ? [{value:"debtor1",label:"Client 1 only (100%)"},{value:"spouse",label:"Non-filing spouse only (100%)"},{value:"both",label:"Owned jointly with non-filing spouse"}]
                        : [{value:"debtor1",label:"Yes — 100% owned by me"},{value:"partial",label:"No — shared ownership with another person"}]
                    }
                  />
                </Field>

                {(data.filingType==="joint"||data.filingType==="individual-nonfiling-spouse") && (data.realPropOwnershipType==="debtor1"||data.realPropOwnershipType==="spouse") && (
                  <>
                    <Field label="Did you own this property before you got married?" error={e("realPropOwnedBeforeMarriage")}>
                      <RadioGroup
                        name="realPropOwnedBeforeMarriage"
                        current={data.realPropOwnedBeforeMarriage}
                        onChange={v=>{u("realPropOwnedBeforeMarriage",v); if(v==="no"){u("realPropMaritalFundsUsed","");u("realPropHasPrenup","");u("realPropInheritedOrGift","");u("realPropCommunityPropFlag",false);}}}
                        error={e("realPropOwnedBeforeMarriage")}
                        options={[{value:"yes",label:"Yes — I had it before we got married"},{value:"no",label:"No — I got it after we got married"},{value:"unknown",label:"I'm not sure"}]}
                      />
                    </Field>

                    {data.realPropOwnedBeforeMarriage==="yes" && (
                      <>
                        <Field label="Was this property given to you as a gift or did you inherit it?" error={e("realPropInheritedOrGift")}>
                          <RadioGroup
                            name="realPropInheritedOrGift"
                            current={data.realPropInheritedOrGift}
                            onChange={v=>u("realPropInheritedOrGift",v)}
                            error={e("realPropInheritedOrGift")}
                            options={[{value:"yes",label:"Yes — someone gave it to me or I inherited it"},{value:"no",label:"No — I bought it with my own money before getting married"},{value:"unsure",label:"I'm not sure"}]}
                          />
                        </Field>
                        <Field label="After you got married, did you ever use money you earned together to pay the mortgage, fix it up, or improve this property?" hint="For example, paying the mortgage from a joint bank account, or paying for repairs and renovations after the wedding." error={e("realPropMaritalFundsUsed")}>
                          <RadioGroup
                            name="realPropMaritalFundsUsed"
                            current={data.realPropMaritalFundsUsed}
                            onChange={v=>u("realPropMaritalFundsUsed",v)}
                            error={e("realPropMaritalFundsUsed")}
                            options={[{value:"yes",label:"Yes — we used money we earned during the marriage"},{value:"no",label:"No — only money I had from before the marriage"},{value:"unsure",label:"I'm not sure / a mix of both"}]}
                          />
                        </Field>
                        {(data.realPropMaritalFundsUsed==="yes"||data.realPropMaritalFundsUsed==="unsure") && (
                          <>
                            <Field label="Did you and your spouse sign a prenup (or postnup) that says this property stays just yours?" hint="A prenup is a written agreement signed before the wedding. A postnup is signed after." error={e("realPropHasPrenup")}>
                              <RadioGroup
                                name="realPropHasPrenup"
                                current={data.realPropHasPrenup}
                                onChange={v=>{u("realPropHasPrenup",v); u("realPropCommunityPropFlag",v==="no"||v==="unsure");}}
                                error={e("realPropHasPrenup")}
                                options={[{value:"yes",label:"Yes — we signed a prenup or postnup that keeps it just mine"},{value:"no",label:"No, we didn't sign anything like that"},{value:"unsure",label:"I'm not sure"}]}
                              />
                            </Field>
                            {(data.realPropHasPrenup==="no"||data.realPropHasPrenup==="unsure") && (
                              <div className="mt-1 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 flex gap-2">
                                <span className="text-red-400 flex-shrink-0">⚑</span>
                                <span><strong>Your attorney needs to look at this:</strong> Even though you owned this property before getting married, because you used money you earned together to pay for it — and you don't have a prenup — this property might now partly or fully belong to both of you. Your attorney will look at this before filing.</span>
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
                {/* Same arrears questions as the primary property — Ch.7
                    won't cure arrears on the second property either; the
                    attorney needs to see this in the Ch.13 plan-funding
                    analysis. */}
                <Field label="Are you current on this mortgage?" error={e("secondMortgageCurrent")}>
                  <RadioGroup name="secMortgCurr" current={data.secondMortgageCurrent} onChange={v=>{
                    u("secondMortgageCurrent", v);
                    if (v === "yes") u("secondMortgageArrears", "0");
                  }} error={e("secondMortgageCurrent")}
                    options={[{value:"yes",label:"Yes — current on all payments"},{value:"no",label:"No — behind on payments"}]}/>
                </Field>
                {data.secondMortgageCurrent === "no" && (
                  <Field label="Total amount past due (mortgage arrears)" hint="Total back payments owed on this property. Ch.7 does NOT cure arrears; Ch.13 cures them through the plan." error={e("secondMortgageArrears")}>
                    <Input type="number" value={data.secondMortgageArrears} onChange={v=>u("secondMortgageArrears", v)} placeholder="Enter amount past due" hasError={!!e("secondMortgageArrears")}/>
                  </Field>
                )}

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
                          ? [{value:"debtor1",label:"Client 1 only"},{value:"debtor2",label:"Client 2 only"},{value:"both",label:"Jointly by both clients"}]
                          : data.filingType==="individual-nonfiling-spouse"
                          ? [{value:"debtor1",label:"Client 1 only"},{value:"spouse",label:"Non-filing spouse only"},{value:"both",label:"Joint with non-filing spouse"}]
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
                <div className="mt-1 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-400 flex gap-2">
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
          <div className="mb-4 p-5 bg-slate-800/60 border border-slate-600 rounded-xl">
            <p className="text-base text-white font-bold leading-relaxed">
              List <strong className="text-amber-400">all personal property</strong> you own — vehicles, bank accounts, retirement, household goods, jewelry, tools, collectibles, etc.
            </p>
            <p className="text-base text-white font-bold leading-relaxed mt-2">
              Also include <strong className="text-amber-400">future claims</strong> (lawsuits, insurance payouts, expected refunds) and <strong className="text-amber-400">money owed to you</strong>.
            </p>
            <p className="text-base text-amber-400 font-bold leading-relaxed mt-2">
              Provide a fair value for each — even small items matter.
            </p>
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
                            <p className="text-xs text-amber-400 mb-3">
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
                              <p className="text-xs font-semibold text-amber-400 mb-1">Value is more than 90 days old — please update</p>
                              <p className="text-xs text-amber-200/70 mb-2">Your vehicle value was last verified over 90 days ago. Please click "{vi?.label || "Look Up Value"}" above to get a current estimate, or visit KBB directly to update the value.</p>
                              <a href={vi?.url || "https://www.kbb.com/whats-my-car-worth/"} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-400 transition-colors">
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
                  {/* Vehicle purchase date — drives two attorney issues:
                      (1) purchased within 90 days → check lien perfection
                          (under § 547, a perfection delay can be voidable;
                           also relates to § 522(f) hanging-paragraph analysis)
                      (2) owned > 910 days when financed → eligible for
                          Ch.13 cramdown (§ 1325(a) hanging paragraph). */}
                  <Field label="When did you purchase this vehicle?" hint="Approximate date is OK. Example: 'March 2022' or '06/15/2021'." error={errors[`veh_${i}_purchaseDate`]}>
                    <Input type="date" value={veh.purchaseDate || ""}
                      onChange={v=>uVehicle(i,"purchaseDate",v)}
                      hasError={!!errors[`veh_${i}_purchaseDate`]}/>
                  </Field>
                  {(() => {
                    if (!veh.purchaseDate) return null;
                    const purchaseDate = new Date(veh.purchaseDate);
                    if (isNaN(purchaseDate.getTime())) return null;
                    const daysSincePurchase = Math.floor((Date.now() - purchaseDate.getTime()) / (1000*60*60*24));
                    if (daysSincePurchase < 90) {
                      return (
                        <div className="mb-3 p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg">
                          <p className="text-sm text-red-200"><strong className="text-red-300">⚑ Flagged for attorney review.</strong> Purchased <strong className="text-white">within the last 90 days</strong> ({daysSincePurchase} day{daysSincePurchase===1?"":"s"} ago). Your attorney will verify the lender's lien perfection — late-perfected liens can be voidable under § 547.</p>
                        </div>
                      );
                    }
                    if (daysSincePurchase >= 910 && (veh.hasLoan === "yes" || veh.isLease === "loan")) {
                      return (
                        <div className="mb-3 p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                          <p className="text-sm text-blue-200"><strong className="text-blue-300">Good news:</strong> Owned <strong className="text-white">{Math.floor(daysSincePurchase/365)} year{Math.floor(daysSincePurchase/365)===1?"":"s"}</strong> ({daysSincePurchase} days). May be eligible for <strong className="text-amber-400">Ch.13 cramdown</strong> to current value (§ 1325(a) hanging paragraph). Your attorney will analyze.</p>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <Field label="What do you intend to do with this vehicle?" error={errors[`veh_${i}_intent`]}>
                    <RadioGroup name={`veh_${i}_intent`} current={veh.intent} onChange={v=>uVehicle(i,"intent",v)} error={errors[`veh_${i}_intent`]}
                      options={[{value:"keep",label:"Keep — I want to keep this vehicle and continue paying"},{value:"surrender",label:"Surrender — I wish to give this vehicle back to the lender"}]}/>
                  </Field>
                  {veh.intent==="surrender" && (
                    <div className="mt-1 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-400">
                      This vehicle will be surrendered. Its loan will not be factored into your plan funding requirements.
                    </div>
                  )}
                  {/* Handicap / disability placard — many states provide an
                      enhanced motor-vehicle exemption for vehicles used by
                      or equipped for a person with a disability. Flagged so
                      the attorney can apply the higher exemption amount. */}
                  <Field label="Do you have a handicap / disability placard for this vehicle?" hint="Example: a state-issued disabled-parking placard or license plate." error={errors[`veh_${i}_hasHandicapPlacard`]}>
                    <RadioGroup name={`veh_${i}_hasHandicapPlacard`} current={veh.hasHandicapPlacard}
                      onChange={v=>uVehicle(i,"hasHandicapPlacard",v)}
                      error={errors[`veh_${i}_hasHandicapPlacard`]}
                      options={[{value:"yes",label:"Yes — handicap placard or plate"},{value:"no",label:"No"}]}/>
                  </Field>
                  {veh.hasHandicapPlacard === "yes" && (
                    <div className="mt-1 mb-3 p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <p className="text-sm text-blue-200"><strong className="text-blue-300">Good news:</strong> The <strong className="text-amber-400">vehicle exemption amount is generally higher</strong> when the vehicle is used by or equipped for a person with a disability. Your attorney will apply the enhanced exemption.</p>
                    </div>
                  )}
                  {/* Lease vs. loan vs. owned outright. Lease drives Schedule G
                      (executory contracts) — flagged below when isLease=yes. */}
                  <Field label="Is this vehicle a lease, financed (loan), or owned outright?" error={errors[`veh_${i}_isLease`]}>
                    <RadioGroup name={`veh_${i}_isLease`} current={veh.isLease}
                      onChange={v=>{
                        uVehicle(i,"isLease",v);
                        // Sync hasLoan so existing downstream code keeps working:
                        // lease + financed both imply monthly payments are owed.
                        if (v === "lease" || v === "loan") uVehicle(i,"hasLoan","yes");
                        if (v === "owned") uVehicle(i,"hasLoan","no");
                      }}
                      error={errors[`veh_${i}_isLease`]}
                      options={[
                        {value:"lease",label:"Lease — I lease this vehicle"},
                        {value:"loan",label:"Financed — there is a loan"},
                        {value:"owned",label:"Owned free and clear — no payments"},
                      ]}/>
                  </Field>
                  {veh.isLease === "lease" && (
                    <div className="mb-3 p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <p className="text-sm text-blue-200"><strong className="text-blue-300">Note:</strong> Leases are <strong className="text-white">executory contracts</strong> and will also be listed on <strong className="text-amber-400">Schedule G</strong>. Your attorney will decide whether to assume or reject the lease.</p>
                    </div>
                  )}
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
                            ? [{value:"debtor1",label:"Client 1 only"},{value:"debtor2",label:"Client 2 only"},{value:"both",label:"Owned jointly by both clients"}]
                            : data.filingType==="individual-nonfiling-spouse"
                            ? [{value:"debtor1",label:"Client 1 only (100%)"},{value:"spouse",label:"Non-filing spouse only (100%)"},{value:"both",label:"Owned jointly with non-filing spouse"}]
                            : [{value:"debtor1",label:"Yes — 100% owned by me"},{value:"partial",label:"No — I share ownership with another person"}]
                        }
                      />
                    </Field>

                    {(data.filingType==="joint"||data.filingType==="individual-nonfiling-spouse") && (veh.ownershipType==="debtor1"||veh.ownershipType==="spouse") && (
                      <>
                        <Field label="Did you own this vehicle before you got married?" error={errors[`veh_${i}_ownedBeforeMarriage`]}>
                          <RadioGroup
                            name={`veh_${i}_ownedBeforeMarriage`}
                            current={veh.ownedBeforeMarriage}
                            onChange={v=>{ uVehicle(i,"ownedBeforeMarriage",v); if(v==="no"){ uVehicle(i,"maritalFundsUsed",""); uVehicle(i,"hasPrenup",""); uVehicle(i,"inheritedOrGift",""); } }}
                            error={errors[`veh_${i}_ownedBeforeMarriage`]}
                            options={[{value:"yes",label:"Yes — I had it before we got married"},{value:"no",label:"No — I got it after we got married"},{value:"unknown",label:"I'm not sure"}]}
                          />
                        </Field>

                        {veh.ownedBeforeMarriage==="yes" && (
                          <>
                            <Field label="Was this vehicle given to you as a gift or did you inherit it?" error={errors[`veh_${i}_inheritedOrGift`]}>
                              <RadioGroup
                                name={`veh_${i}_inheritedOrGift`}
                                current={veh.inheritedOrGift}
                                onChange={v=>uVehicle(i,"inheritedOrGift",v)}
                                error={errors[`veh_${i}_inheritedOrGift`]}
                                options={[{value:"yes",label:"Yes — someone gave it to me or I inherited it"},{value:"no",label:"No — I bought it myself"},{value:"unsure",label:"I'm not sure"}]}
                              />
                            </Field>
                            <Field label="After you got married, did you ever use money you earned together to pay for, fix, or upgrade this vehicle?" hint="For example, paying the loan from a joint bank account, or paying for repairs with money you made after the wedding." error={errors[`veh_${i}_maritalFundsUsed`]}>
                              <RadioGroup
                                name={`veh_${i}_maritalFundsUsed`}
                                current={veh.maritalFundsUsed}
                                onChange={v=>uVehicle(i,"maritalFundsUsed",v)}
                                error={errors[`veh_${i}_maritalFundsUsed`]}
                                options={[{value:"yes",label:"Yes — we used money we earned during the marriage"},{value:"no",label:"No — only money I had from before the marriage"},{value:"unsure",label:"I'm not sure"}]}
                              />
                            </Field>
                            {(veh.maritalFundsUsed==="yes"||veh.maritalFundsUsed==="unsure") && (
                              <>
                                <Field label="Did you and your spouse sign a prenup (or postnup) that says this vehicle stays just yours?" hint="A prenup is a written agreement signed before the wedding. A postnup is signed after." error={errors[`veh_${i}_hasPrenup`]}>
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
                                    <span><strong>Your attorney needs to look at this:</strong> Because you used money you earned together (during the marriage) to pay for this vehicle — and you don't have a prenup saying it's only yours — this vehicle might now belong to both of you under the law. Your attorney will look at this carefully before filing.</span>
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

          {/* Recreational Vehicles — motorcycles, ATVs/quads, boats, jet skis,
              travel trailers, planes, snowmobiles, RVs, etc. Treated as
              titled / Schedule A/B property; any with a loan auto-populates
              Schedule D and Schedule J transportation downstream. */}
          <SectionCard title="Recreational Vehicles & Watercraft — Schedule A/B" icon="🛥️">
            <Field label="Do you own any motorcycles, quads / ATVs, boats, jet skis, travel trailers, RVs, planes, or other recreational vehicles?" error={e("hasRecreationalVehicles")}>
              <RadioGroup name="hasRecreationalVehicles" current={data.hasRecreationalVehicles}
                onChange={v=>u("hasRecreationalVehicles",v)} error={e("hasRecreationalVehicles")}
                options={[{value:"yes",label:"Yes — I own recreational vehicles or watercraft"},{value:"no",label:"No — I do not own any"}]}/>
            </Field>
            {data.hasRecreationalVehicles==="yes" && (
              <>
                {(data.recreationalVehicles || []).map((rv, i) => (
                  <div key={rv.id} className="bg-slate-900/60 border border-slate-600 rounded-xl p-4 mb-3">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Recreational Vehicle {i+1}</p>
                      {(data.recreationalVehicles || []).length > 1 && (
                        <button type="button"
                          onClick={()=>u("recreationalVehicles", data.recreationalVehicles.filter(x => x.id !== rv.id))}
                          className="text-xs text-red-400 hover:text-red-300 border border-red-400/30 px-2 py-1 rounded-lg">Remove</button>
                      )}
                    </div>
                    <Field label="Type" error={errors[`rv_${i}_type`]}>
                      <Select value={rv.type}
                        onChange={v=>u("recreationalVehicles", data.recreationalVehicles.map((x,idx)=>idx===i?{...x,type:v}:x))}
                        hasError={!!errors[`rv_${i}_type`]}
                        options={["Motorcycle","ATV / Quad","Boat","Jet Ski / PWC","Travel Trailer","Motorhome / RV","Airplane","Snowmobile","Other"]}
                        placeholder="Select type..."/>
                    </Field>
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="Year">
                        <Input value={rv.year || ""}
                          onChange={v=>u("recreationalVehicles", data.recreationalVehicles.map((x,idx)=>idx===i?{...x,year:v}:x))}
                          placeholder="e.g. 2018"/>
                      </Field>
                      <Field label="Make">
                        <Input value={rv.make || ""}
                          onChange={v=>u("recreationalVehicles", data.recreationalVehicles.map((x,idx)=>idx===i?{...x,make:v}:x))}
                          placeholder="e.g. Yamaha"/>
                      </Field>
                      <Field label="Model">
                        <Input value={rv.model || ""}
                          onChange={v=>u("recreationalVehicles", data.recreationalVehicles.map((x,idx)=>idx===i?{...x,model:v}:x))}
                          placeholder="e.g. WaveRunner"/>
                      </Field>
                    </div>
                    <Field label="Estimated Market Value" error={errors[`rv_${i}_value`]}>
                      <Input type="number" value={rv.value || ""}
                        onChange={v=>u("recreationalVehicles", data.recreationalVehicles.map((x,idx)=>idx===i?{...x,value:v}:x))}
                        placeholder="Enter amount" hasError={!!errors[`rv_${i}_value`]}/>
                    </Field>
                    <Field label="What do you intend to do with this?">
                      <RadioGroup name={`rv_${i}_intent`} current={rv.intent}
                        onChange={v=>u("recreationalVehicles", data.recreationalVehicles.map((x,idx)=>idx===i?{...x,intent:v}:x))}
                        options={[{value:"keep",label:"Keep — continue paying"},{value:"surrender",label:"Surrender — give back to lender"}]}/>
                    </Field>
                    <Field label="Is there a loan on this item?" error={errors[`rv_${i}_hasLoan`]}>
                      <RadioGroup name={`rv_${i}_hasLoan`} current={rv.hasLoan}
                        onChange={v=>u("recreationalVehicles", data.recreationalVehicles.map((x,idx)=>idx===i?{...x,hasLoan:v}:x))}
                        error={errors[`rv_${i}_hasLoan`]}
                        options={[{value:"yes",label:"Yes — there is a loan"},{value:"no",label:"No — owned free and clear"}]}/>
                    </Field>
                    {rv.hasLoan === "yes" && (
                      <>
                        <Field label="Lender Name">
                          <Input value={rv.lenderName || ""}
                            onChange={v=>u("recreationalVehicles", data.recreationalVehicles.map((x,idx)=>idx===i?{...x,lenderName:v}:x))}
                            placeholder="e.g. Bank of the West, Sheffield Financial"/>
                        </Field>
                        <div className="grid grid-cols-2 gap-3 mt-1">
                          <Field label="Loan Balance" error={errors[`rv_${i}_loanBalance`]}>
                            <Input type="number" value={rv.loanBalance || ""}
                              onChange={v=>u("recreationalVehicles", data.recreationalVehicles.map((x,idx)=>idx===i?{...x,loanBalance:v}:x))}
                              placeholder="Enter amount" hasError={!!errors[`rv_${i}_loanBalance`]}/>
                          </Field>
                          <Field label="Monthly Payment" error={errors[`rv_${i}_monthlyPayment`]}>
                            <Input type="number" value={rv.monthlyPayment || ""}
                              onChange={v=>u("recreationalVehicles", data.recreationalVehicles.map((x,idx)=>idx===i?{...x,monthlyPayment:v}:x))}
                              placeholder="Enter amount" hasError={!!errors[`rv_${i}_monthlyPayment`]}/>
                          </Field>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                <button type="button"
                  onClick={()=>u("recreationalVehicles", [...(data.recreationalVehicles || []), { id: Date.now(), type:"", make:"", model:"", year:"", value:"", hasLoan:"", lenderName:"", loanBalance:"", monthlyPayment:"", intent:"keep" }])}
                  className="w-full border border-dashed border-amber-400/40 hover:border-amber-400 text-amber-400 text-sm font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 mb-2">
                  <span className="text-lg">+</span> Add Another Recreational Vehicle
                </button>
                {(data.recreationalVehicles || []).filter(rv => rv.hasLoan === "yes" && parseFloat(rv.loanBalance) > 0).length > 0 && (
                  <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs text-blue-300">
                    📋 Financed recreational vehicles will auto-populate Schedule D (secured creditors) and Schedule J transportation.
                  </div>
                )}
              </>
            )}
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

          {/* Health Savings (HSA) / Flexible Spending (FSA) — these aren't
              bank accounts and aren't retirement, but they ARE assets that
              must be listed on Schedule A/B. Exemption treatment varies. */}
          <SectionCard title="Health Savings (HSA) / Flexible Spending (FSA) Accounts — Schedule A/B" icon="🩺">
            <Field label="Do you have a Health Savings Account (HSA) or Flexible Spending Account (FSA)?" hint="Example: an HSA tied to a high-deductible health plan, or an FSA you fund through payroll deductions." error={e("hasHsaFsa")}>
              <RadioGroup name="hasHsaFsa" current={data.hasHsaFsa}
                onChange={v=>u("hasHsaFsa",v)} error={e("hasHsaFsa")}
                options={[{value:"yes",label:"Yes — I have an HSA or FSA"},{value:"no",label:"No"}]}/>
            </Field>
            {data.hasHsaFsa === "yes" && (
              <div className="mt-2 space-y-2">
                {(data.hsaFsaEntries || []).map((acc, i) => (
                  <div key={acc.id} className="bg-slate-900/60 border border-slate-600 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Account #{i+1}</p>
                      {(data.hsaFsaEntries || []).length > 1 && (
                        <button type="button"
                          onClick={()=>u("hsaFsaEntries", data.hsaFsaEntries.filter(x => x.id !== acc.id))}
                          className="text-xs text-red-400 hover:text-red-300 underline">Remove</button>
                      )}
                    </div>
                    <Field label="Account type" error={errors[`hsafsa_${i}_accountType`]}>
                      <Select value={acc.accountType}
                        onChange={v=>u("hsaFsaEntries", data.hsaFsaEntries.map((x,idx)=>idx===i?{...x,accountType:v}:x))}
                        hasError={!!errors[`hsafsa_${i}_accountType`]}
                        options={[
                          {value:"hsa",label:"HSA — Health Savings Account"},
                          {value:"fsa",label:"FSA — Flexible Spending Account"},
                          {value:"hra",label:"HRA — Health Reimbursement Arrangement"},
                          {value:"dcfsa",label:"Dependent-Care FSA"},
                        ]}
                        placeholder="Pick a type..."/>
                    </Field>
                    <Field label="Provider / administrator" error={errors[`hsafsa_${i}_provider`]}>
                      <Input value={acc.provider || ""}
                        onChange={v=>u("hsaFsaEntries", data.hsaFsaEntries.map((x,idx)=>idx===i?{...x,provider:v}:x))}
                        placeholder="e.g. Fidelity, HealthEquity, your employer's plan administrator"
                        hasError={!!errors[`hsafsa_${i}_provider`]}/>
                    </Field>
                    <Field label="Current balance" error={errors[`hsafsa_${i}_balance`]}>
                      <Input type="number" value={acc.balance || ""}
                        onChange={v=>u("hsaFsaEntries", data.hsaFsaEntries.map((x,idx)=>idx===i?{...x,balance:v}:x))}
                        placeholder="Enter amount"
                        hasError={!!errors[`hsafsa_${i}_balance`]}/>
                    </Field>
                  </div>
                ))}
                <button type="button"
                  onClick={()=>u("hsaFsaEntries", [...(data.hsaFsaEntries || []), { id: Date.now(), accountType:"", provider:"", balance:"" }])}
                  className="w-full border border-dashed border-amber-400/40 hover:border-amber-400 text-amber-400 text-sm font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                  <span className="text-lg">+</span> Add Another Account
                </button>
              </div>
            )}
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
                        <div className={`p-2 rounded-lg mb-3 text-xs ${acctDef.exempt===false?"bg-red-400/10 border border-red-400/30 text-red-300":acctDef.erisa||acctDef.iraCapApplies?"bg-green-400/10 border border-green-400/30 text-green-300":"bg-amber-400/10 border border-amber-400/30 text-amber-400"}`}>
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
                      <div className={`p-3 rounded-lg mb-3 text-xs border ${seasoned ? "bg-blue-400/10 border-blue-400/30 text-blue-300" : "bg-amber-400/10 border-amber-400/30 text-amber-400"}`}>
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
                      <div className={`p-3 rounded-lg mb-3 text-xs border ${seasoned ? "bg-blue-400/10 border-blue-400/30 text-blue-300" : "bg-amber-400/10 border-amber-400/30 text-amber-400"}`}>
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
            <Field label="Do you have any pending claims, lawsuits, or money owed to you?" hint="Example: a lawsuit you filed against someone, money a court ordered someone to pay you, an insurance claim still in process." error={e("hasPendingClaims")}>
              <RadioGroup name="hasClaims" current={data.hasPendingClaims} onChange={v=>u("hasPendingClaims",v)} error={e("hasPendingClaims")}
                options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
            </Field>
            {data.hasPendingClaims==="yes" && (
              <>
                <Field label="Value of the claim" error={e("pendingClaimsValue")}>
                  {data.pendingClaimsValueUnknown ? (
                    <div className="flex items-center justify-between bg-slate-800/40 border border-slate-600 rounded-xl px-4 py-2.5">
                      <span className="text-slate-300 text-sm">Value unknown — attorney will estimate</span>
                      <button type="button" onClick={()=>u("pendingClaimsValueUnknown",false)} className="text-xs text-amber-400 hover:text-amber-300 underline">Enter amount instead</button>
                    </div>
                  ) : (
                    <div className="flex gap-2 items-start">
                      <div className="flex-1">
                        <Input type="number" value={data.pendingClaimsValue}
                          onChange={v=>u("pendingClaimsValue",v)}
                          placeholder="Enter dollar amount" hasError={!!e("pendingClaimsValue")}/>
                      </div>
                      <button type="button"
                        onClick={()=>{u("pendingClaimsValueUnknown",true); u("pendingClaimsValue","");}}
                        className="flex-shrink-0 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-slate-500 text-slate-400 hover:text-slate-200 px-3 py-2.5 rounded-xl transition-all whitespace-nowrap">
                        Unknown
                      </button>
                    </div>
                  )}
                </Field>
                <Field label="Details — what is the claim about?" error={e("pendingClaimsDesc")}>
                  <Input value={data.pendingClaimsDesc} onChange={v=>u("pendingClaimsDesc",v)} placeholder="Nature of the claim, who owes you, status" hasError={!!e("pendingClaimsDesc")}/>
                </Field>
                <div className="mt-1 mb-3 p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-200"><strong className="text-red-300">⚑ Flagged for attorney review.</strong> Pending claims you may collect on are <strong className="text-white">assets</strong> of the bankruptcy estate and must be valued and disclosed on Schedule A/B.</p>
                </div>
              </>
            )}

            {/* Pending personal injury claims — flagged for attorney review. */}
            <Field label="Do you have any pending personal injury claims?" hint="Car accident, slip and fall, medical malpractice, workplace injury, etc." error={e("hasPiClaimInProperty")}>
              <RadioGroup name="hasPiClaimInProperty" current={data.hasPiClaimInProperty}
                onChange={v=>u("hasPiClaimInProperty",v)} error={e("hasPiClaimInProperty")}
                options={[{value:"yes",label:"Yes — I have a personal injury claim"},{value:"no",label:"No"}]}/>
            </Field>
            {data.hasPiClaimInProperty === "yes" && (
              <>
                <Field label="Briefly describe the personal injury claim" error={e("piClaimInPropertyDetails")}>
                  <Input value={data.piClaimInPropertyDetails || ""}
                    onChange={v=>u("piClaimInPropertyDetails",v)}
                    placeholder="What happened, when, who's involved, attorney name if any"
                    hasError={!!e("piClaimInPropertyDetails")}/>
                </Field>
                <div className="mt-1 mb-3 p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-[11px] text-red-300"><strong className="text-red-400">⚑ Flagged for attorney review.</strong> Personal injury claims are <strong className="text-white">assets</strong> that must be listed and may qualify for an exemption. We'll ask more details on the next page.</p>
                </div>
              </>
            )}

            {/* Inheritance / estate / trust expectations — flagged for review. */}
            <Field label="Do you expect to receive any money from a will, trust, or estate?" hint="Inheritance from a parent, payout from a trust, life-insurance beneficiary, etc." error={e("expectsInheritance")}>
              <RadioGroup name="expectsInheritance" current={data.expectsInheritance}
                onChange={v=>u("expectsInheritance",v)} error={e("expectsInheritance")}
                options={[{value:"yes",label:"Yes — I expect to receive something"},{value:"no",label:"No"}]}/>
            </Field>
            {data.expectsInheritance === "yes" && (
              <>
                <Field label="Briefly describe what you expect to receive" error={e("inheritanceDetails")}>
                  <Input value={data.inheritanceDetails || ""}
                    onChange={v=>u("inheritanceDetails",v)}
                    placeholder="Who passed / set up the trust, expected amount, when"
                    hasError={!!e("inheritanceDetails")}/>
                </Field>
                <div className="mt-1 mb-3 p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-[11px] text-red-300"><strong className="text-red-400">⚑ Flagged for attorney review.</strong> Money you'll receive from a <strong className="text-white">will, trust, or estate</strong> within <strong className="text-white">180 days after filing</strong> belongs to the bankruptcy estate (11 U.S.C. § 541(a)(5)). Your attorney will time the filing carefully.</p>
                </div>
              </>
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
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-400 leading-relaxed">
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
            <Field label="Does anyone owe you money?" hint="Loans, security deposits, tax refunds, wages owed, etc." error={e("hasMoneyOwed")}>
              <RadioGroup name="hasMoneyOwed" current={data.hasMoneyOwed} onChange={v=>u("hasMoneyOwed",v)} error={e("hasMoneyOwed")}
                options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
            </Field>
            {data.hasMoneyOwed==="yes" && (
              <div className="mt-2 space-y-2">
                {(data.moneyOwedEntries || []).map((mo, i) => (
                  <div key={mo.id} className="bg-slate-900/60 border border-slate-600 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Money Owed #{i+1}</p>
                      {(data.moneyOwedEntries || []).length > 1 && (
                        <button type="button"
                          onClick={()=>u("moneyOwedEntries", data.moneyOwedEntries.filter(x => x.id !== mo.id))}
                          className="text-xs text-red-400 hover:text-red-300 underline">Remove</button>
                      )}
                    </div>
                    <Field label="What type of money is owed to you?" error={errors[`moneyOwed_${i}_sourceType`]}>
                      <Select value={mo.sourceType}
                        onChange={v=>u("moneyOwedEntries", data.moneyOwedEntries.map((x,idx)=>idx===i?{...x,sourceType:v}:x))}
                        hasError={!!errors[`moneyOwed_${i}_sourceType`]}
                        options={[
                          "Personal loan to family / friend",
                          "Security deposit (rental, utility)",
                          "Tax refund (federal / state)",
                          "Wages or commissions owed by an employer",
                          "Business loan or receivable",
                          "Court-ordered judgment in your favor",
                          "Settlement payment",
                          "Insurance claim payout",
                          "Other",
                        ]}
                        placeholder="Pick a type..."/>
                    </Field>
                    <Field label="Who owes it to you and why?" error={errors[`moneyOwed_${i}_sourceDescription`]}>
                      <Input value={mo.sourceDescription || ""}
                        onChange={v=>u("moneyOwedEntries", data.moneyOwedEntries.map((x,idx)=>idx===i?{...x,sourceDescription:v}:x))}
                        placeholder="e.g. Brother John — loan for car repair"
                        hasError={!!errors[`moneyOwed_${i}_sourceDescription`]}/>
                    </Field>
                    <Field label="How much is owed?" error={errors[`moneyOwed_${i}_amount`]}>
                      <Input type="number" value={mo.amount || ""}
                        onChange={v=>u("moneyOwedEntries", data.moneyOwedEntries.map((x,idx)=>idx===i?{...x,amount:v}:x))}
                        placeholder="Enter amount" hasError={!!errors[`moneyOwed_${i}_amount`]}/>
                    </Field>
                    <Field label="Do you expect to actually collect this money?" error={errors[`moneyOwed_${i}_expectsToCollect`]}>
                      <RadioGroup name={`moneyOwed_${i}_expectsToCollect`} current={mo.expectsToCollect}
                        onChange={v=>u("moneyOwedEntries", data.moneyOwedEntries.map((x,idx)=>idx===i?{...x,expectsToCollect:v}:x))}
                        error={errors[`moneyOwed_${i}_expectsToCollect`]}
                        options={[
                          {value:"yes",label:"Yes — I expect to collect"},
                          {value:"no",label:"No — I don't expect to get it back"},
                          {value:"unsure",label:"Not sure"},
                        ]}/>
                    </Field>
                  </div>
                ))}
                <button type="button"
                  onClick={()=>u("moneyOwedEntries", [...(data.moneyOwedEntries || []), { id: Date.now(), sourceType:"", sourceDescription:"", amount:"", expectsToCollect:"" }])}
                  className="w-full border border-dashed border-amber-400/40 hover:border-amber-400 text-amber-400 text-xs font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2">
                  <span className="text-base">+</span> Add Another
                </button>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Household & Personal Property — Schedule A/B" icon="💰">
            <p className="text-xs text-slate-400 mb-3">Enter the estimated <span className="text-white font-semibold">fair market value</span> — what a willing buyer would pay today, not the original retail price. List all assets owned by anyone in the household. Use "I don't have this" to skip items that don't apply.</p>
            <ExpenseField label="Household Goods & Furniture" hint="Sofas, beds, tables, appliances, kitchenware, and other furnishings" error={e("householdGoodsValue")} value={data.householdGoodsValue} onChange={v=>u("householdGoodsValue",v)} badge="Fair Market Value"/>
            <ExpenseField label="Electronics" hint="Phones, computers, tablets, TVs, gaming consoles, cameras, and similar devices" error={e("electronicsValue")} value={data.electronicsValue} onChange={v=>u("electronicsValue",v)} badge="Fair Market Value"/>
            <ExpenseField label="Jewelry & Watches" hint="Rings, necklaces, bracelets, watches — include all household members' items" error={e("jewelryValue")} value={data.jewelryValue} onChange={v=>u("jewelryValue",v)} badge="Fair Market Value"/>
            <ExpenseField label="Personal Handtools and Equipment" hint="Household hand & power tools only. List business tools in the Business Property section below." error={e("toolsValue")} value={data.toolsValue} onChange={v=>u("toolsValue",v)} badge="Fair Market Value"/>
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
              <div className="p-3 rounded-xl bg-amber-400/5 border border-amber-400/20 text-xs text-amber-400 leading-relaxed">
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
          <div className="mb-4 p-5 bg-slate-800/60 border border-slate-600 rounded-xl">
            <p className="text-base text-white font-bold leading-relaxed">
              Your expenses go on <strong className="text-amber-400">Official Form 106J (Schedule J)</strong> and into the <strong className="text-amber-400">Means Test</strong> to figure out your <strong className="text-amber-400">disposable income</strong>.
            </p>
            <p className="text-base text-white font-bold leading-relaxed mt-2">
              For food, housekeeping, clothing, personal care, and miscellaneous, the IRS publishes <strong className="text-amber-400">National Standards</strong>. We'll show you those numbers as a guide.
            </p>
            <p className="text-base text-amber-400 font-bold leading-relaxed mt-2">
              Enter your actual monthly amounts. If you spend more than the IRS standard, that's fine — we'll flag it for attorney review.
            </p>
          </div>
          {/* Up-front choice — manual entry vs. IRS-standards auto-fill.
              Auto-fill only touches the IRS-bound categories (food,
              housekeeping, clothing, personal care, misc, utilities, gas/
              maintenance, vehicle insurance). Rent / mortgage / car payment
              / childcare / education stay manual so the client enters their
              actual numbers for those. */}
          {!data.expenseFillMode ? (
            <div className="mb-4 p-5 bg-slate-800/60 border border-slate-600 rounded-xl">
              <p className="text-base font-bold text-amber-400 mb-2 text-center">How would you like to fill out your expenses?</p>
              <p className="text-base text-white font-bold leading-relaxed mb-4 text-center">
                Pick one — you can change individual amounts later.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button type="button"
                  onClick={()=>u("expenseFillMode","manual")}
                  className="text-left p-4 rounded-xl border border-slate-600 bg-slate-900/40 hover:border-amber-400 hover:bg-amber-400/5 transition-all">
                  <p className="text-base font-bold text-white mb-1">✍️ Enter my actual amounts</p>
                  <p className="text-sm text-slate-400 leading-relaxed">I'll type each amount myself.</p>
                </button>
                <button type="button"
                  onClick={()=>{ u("expenseFillMode","auto"); autoFillIrsStandards(); }}
                  className="text-left p-4 rounded-xl border border-amber-400/50 bg-amber-400/10 hover:border-amber-400 hover:bg-amber-400/20 transition-all">
                  <p className="text-base font-bold text-amber-400 mb-1">⚡ Auto-fill using standard amounts</p>
                  <p className="text-sm text-amber-200/90 leading-relaxed">
                    Pre-fill food, household, utilities, clothing, personal care, gas, and vehicle insurance using the IRS standard for a <strong>{hhSizeExp}-person household</strong>.
                  </p>
                </button>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed mt-4">
                <strong className="text-amber-400">Note:</strong> Rent / mortgage, car payment, childcare, and children's education are <strong>not auto-filled</strong> — you'll enter your actual amounts for those.
              </p>
            </div>
          ) : (
            <div className="mb-4 px-4 py-2.5 bg-slate-800/60 border border-slate-600 rounded-xl flex items-center justify-between">
              <p className="text-sm text-white font-bold">
                {data.expenseFillMode === "auto"
                  ? <>⚡ Using <strong className="text-amber-400">IRS standard</strong> amounts. You can edit any line.</>
                  : <>✍️ <strong className="text-amber-400">Manual entry</strong> — enter each amount yourself.</>}
              </p>
              <button type="button" onClick={()=>u("expenseFillMode","")}
                className="text-xs text-amber-400 hover:text-amber-400 underline">Change</button>
            </div>
          )}
          <p className="text-base text-white font-bold leading-relaxed mb-4 p-3 bg-slate-800/60 border border-slate-700 rounded-xl">
            All fields are required — if a category does not apply, click <strong className="text-amber-400">I don't have this</strong>.
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
            {/* Other-secured-creditor payments tied to real-property collateral
                (e.g., a HELOC, second-trust deed, or property tax lien added
                in Schedule D's "other secured" list). Read-only — source of
                truth is the Schedule D otherSecuredCreditors entries. */}
            {(data.otherSecuredCreditors || []).filter(sc => (sc.collateralAssetKey || "").startsWith("realProperty:")).filter(sc => parseFloat(sc.monthlyPayment) > 0).length > 0 && (
              <div className="mb-4">
                <label className="block text-xs font-semibold uppercase tracking-widest text-amber-400 mb-2">Other Secured Housing Payments</label>
                {(data.otherSecuredCreditors || []).filter(sc => (sc.collateralAssetKey || "").startsWith("realProperty:")).filter(sc => parseFloat(sc.monthlyPayment) > 0).map(sc => (
                  <div key={`osc-rp-${sc.id}`} className="flex items-center justify-between bg-slate-700/60 border border-green-500/40 rounded-lg px-4 py-3 mb-2">
                    <div>
                      <p className="text-sm font-semibold text-green-400">${parseFloat(sc.monthlyPayment).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}/mo</p>
                      <p className="text-xs text-slate-400">{sc.creditorName || "Other secured creditor"}{sc.collateralDescription ? ` — ${sc.collateralDescription}` : ""}</p>
                    </div>
                    <span className="text-xs text-slate-500">from Schedule D</span>
                  </div>
                ))}
              </div>
            )}
            {/* Mortgage PITI question — asked in the Real Estate section
                (Schedule A/B). The answer carries here via the shared
                `mortgageIncludesInsurance` state field. We show a read-only
                chip with a "Confirm" button so the client can verify the
                answer is still correct. If they need to change it, the
                Change link sends them back to the picker below. For renters
                and clients without a mortgage we still show the picker. */}
            {data.mortgageIncludesInsurance && data.mortgageIncludesInsurance !== "renter" ? (
              <div className="mb-4">
                <label className="block text-xs font-semibold uppercase tracking-widest text-amber-400 mb-1">Mortgage Type</label>
                <div className="flex items-center justify-between w-full bg-slate-700/60 border border-green-500/40 rounded-lg px-4 py-3">
                  <span className="text-green-400 font-bold text-sm">
                    {data.mortgageIncludesInsurance === "both" && "Mortgage includes BOTH taxes & insurance (PITI)"}
                    {data.mortgageIncludesInsurance === "taxonly" && "Mortgage includes taxes only — insurance paid separately"}
                    {data.mortgageIncludesInsurance === "insonly" && "Mortgage includes insurance only — taxes paid separately"}
                    {data.mortgageIncludesInsurance === "neither" && "Mortgage does NOT include taxes or insurance — both paid separately"}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 text-xs">from Real Property section</span>
                    <button type="button"
                      onClick={()=>u("mortgageIncludesInsurance","")}
                      className="text-xs font-semibold text-amber-400 hover:text-amber-300 underline">
                      Change
                    </button>
                  </div>
                </div>
              </div>
            ) : (
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
            )}
            {/* Mortgage-current + arrears questions used to live here in the
                Expenses section. Moved to the Real Property section so the
                question sits with the mortgage creditor it asks about, and
                so the same arrears questions exist for BOTH the primary and
                the second property. State keys (mortgageCurrent / mortgageArrears)
                are unchanged — answers entered in the property section flow
                through to the same expense calculations downstream. If the
                client somehow reaches the expenses section without having
                answered them in the property section, a read-only summary
                shows the current value: */}
            {data.mortgageIncludesInsurance && data.mortgageIncludesInsurance!=="renter" && data.mortgageCurrent && (
              <div className="mb-4 p-3 bg-slate-800/40 border border-slate-700 rounded-xl text-xs">
                <p className="text-slate-400">
                  Mortgage current?{" "}
                  <span className="text-white font-semibold">
                    {data.mortgageCurrent === "yes" ? "Yes — current" : "No — behind on payments"}
                  </span>
                  {data.mortgageCurrent === "no" && data.mortgageArrears && (
                    <> · <span className="text-amber-400 font-semibold">${parseFloat(data.mortgageArrears).toLocaleString()} arrears</span></>
                  )}
                </p>
                <p className="text-slate-500 mt-1 text-[10px]">Edit in the Real Property section above.</p>
              </div>
            )}
            {(data.mortgageIncludesInsurance==="insonly"||data.mortgageIncludesInsurance==="neither") && (
              <ExpenseField label="Monthly Property Tax" error={e("expPropTax")} value={data.expPropTax} onChange={v=>u("expPropTax",v)}/>
            )}
            {data.mortgageIncludesInsurance!=="renter" && (
              <>
                {/* HOA — auto-pulled from Schedule A/B when the client said
                    "Yes I have an HOA" + entered monthly dues. Read-only here
                    so we don't ask the same question twice. */}
                {data.hasHoa === "yes" && parseFloat(data.hoaMonthlyDues) > 0 ? (
                  <div className="mb-4">
                    <label className="block text-xs font-semibold uppercase tracking-widest text-amber-400 mb-1">HOA / Condo Fees</label>
                    <div className="flex items-center justify-between w-full bg-slate-700/60 border border-green-500/40 rounded-lg px-4 py-3">
                      <span className="text-green-400 font-bold">${parseFloat(data.hoaMonthlyDues || 0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}/mo</span>
                      <span className="text-slate-400 text-xs">auto-filled from Real Property{data.hoaName ? ` — ${data.hoaName}` : ""}</span>
                    </div>
                  </div>
                ) : data.hasHoa === "no" ? (
                  <div className="mb-4">
                    <label className="block text-xs font-semibold uppercase tracking-widest text-amber-400 mb-1">HOA / Condo Fees</label>
                    <div className="flex items-center gap-2 w-full bg-slate-700/60 border border-slate-600 rounded-lg px-4 py-3">
                      <span className="text-slate-400 text-sm">No HOA — confirmed in Real Property section</span>
                    </div>
                  </div>
                ) : (
                  <ExpenseField label="HOA / Condo Fees" error={e("expHoa")} value={data.expHoa} onChange={v=>u("expHoa",v)}/>
                )}
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
              <p className="text-sm text-slate-400 mb-3">IRS transport standard ({numVehicles} vehicle{numVehicles!==1?"s":""}, {data.county} County): <span className="text-cyan-400 font-semibold">${transportStd.bundle.toLocaleString()}/mo total</span></p>
            )}
            {/* Gas/fuel/maintenance — only relevant if the client owns or
                regularly drives a vehicle. Single consolidated field; the
                separate "Vehicle Maintenance & Repairs" line was removed
                because it overlapped with the IRS bundle anyway. */}
            {numVehicles > 0 && (
              <IrsExpenseField label="Gas, Fuel & Vehicle Maintenance" hint="Combined: fuel + repairs + maintenance + registration + parking" category={null} hhSize={hhSizeExp} value={data.expGasFuel} onChange={v=>u("expGasFuel",v)} overrideReason={data.expGasFuelOverride} onOverrideReasonChange={v=>u("expGasFuelOverride",v)} error={e("expGasFuel")} customStandard={transportStd && !transportStd.isTransit ? transportStd.fuelMaintenance : null} customLabel={transportStd && !transportStd.isTransit ? `${data.county} County area — fuel, maintenance, repairs, registration, parking` : null}/>
            )}
            <ExpenseField label="Public Transit / Rideshare" error={e("expPublicTransit")} value={data.expPublicTransit} onChange={v=>u("expPublicTransit",v)}/>

            {/* Borrowed-vehicle / shared-use disclosure. Flagged for attorney
                review — they may need to document the arrangement and decide
                whether to allow an "ownership cost" for means-test purposes
                if the client effectively pays for someone else's vehicle. */}
            <div className="mt-3 pt-3 border-t border-slate-700/60">
              <Field label="Do you regularly use a vehicle that belongs to someone else?" hint="A parent's car, spouse's truck, a co-signed vehicle in another name, etc." error={e("borrowedVehicleUse")}>
                <RadioGroup name="borrowedVehicleUse" current={data.borrowedVehicleUse}
                  onChange={v=>u("borrowedVehicleUse",v)} error={e("borrowedVehicleUse")}
                  options={[{value:"yes",label:"Yes — I drive someone else's vehicle"},{value:"no",label:"No"}]}/>
              </Field>
              {data.borrowedVehicleUse === "yes" && (
                <>
                  <Field label="Do you pay any costs for that vehicle (gas, payment, insurance, maintenance)?" error={e("borrowedVehiclePays")}>
                    <RadioGroup name="borrowedVehiclePays" current={data.borrowedVehiclePays}
                      onChange={v=>u("borrowedVehiclePays",v)} error={e("borrowedVehiclePays")}
                      options={[{value:"yes",label:"Yes — I help pay for it"},{value:"no",label:"No — the other person pays everything"}]}/>
                  </Field>
                  {data.borrowedVehiclePays === "yes" && (
                    <>
                      <Field label="How much do you pay each month?" error={e("borrowedVehicleAmount")}>
                        <Input type="number" value={data.borrowedVehicleAmount}
                          onChange={v=>u("borrowedVehicleAmount",v)}
                          placeholder="e.g. 200" hasError={!!e("borrowedVehicleAmount")}/>
                      </Field>
                      <Field label="Whose vehicle is it and what do you pay for?" error={e("borrowedVehicleDescription")}>
                        <Input value={data.borrowedVehicleDescription}
                          onChange={v=>u("borrowedVehicleDescription",v)}
                          placeholder="e.g. Mom's 2018 Honda — I cover gas and insurance"
                          hasError={!!e("borrowedVehicleDescription")}/>
                      </Field>
                    </>
                  )}
                  <div className="mt-1 mb-3 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <p className="text-sm text-amber-200/95"><strong className="text-amber-400">⚑ Flagged for attorney review.</strong> Driving someone else's vehicle can affect the IRS transportation allowance on the means test. Your attorney will document the arrangement.</p>
                  </div>
                </>
              )}
            </div>
            {/* Auto-pulled financed vehicle payments (read-only, source = Schedule A/B). */}
            {financedVehicles().length===0 && (data.recreationalVehicles || []).filter(rv => rv.hasLoan === "yes" && parseFloat(rv.monthlyPayment) > 0).length === 0 && (
              <div className="p-3 bg-slate-700/50 rounded-lg text-xs text-slate-400">No financed vehicles or recreational vehicles on file.</div>
            )}
            {financedVehicles().map((v)=>(
              <Field key={v.id} label={`${v.year} ${v.make} ${v.model} — Monthly Loan Payment`}>
                <div className="flex items-center justify-between bg-slate-700/60 border border-green-500/40 rounded-lg px-3 py-2">
                  <span className="text-green-400 font-semibold text-sm">${(parseFloat(v.monthlyPayment)||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}/mo</span>
                  <span className="text-xs text-slate-500">auto-filled from Vehicles</span>
                </div>
              </Field>
            ))}
            {/* Auto-pulled recreational vehicle payments (read-only, source =
                Recreational Vehicles & Watercraft section). Same auto-fill
                pattern as primary vehicles so the client isn't asked twice. */}
            {(data.recreationalVehicles || []).filter(rv => rv.hasLoan === "yes" && parseFloat(rv.monthlyPayment) > 0).map((rv) => (
              <Field key={`rv-${rv.id}`} label={`${rv.year || ""} ${rv.make || ""} ${rv.model || ""}`.trim() ? `${rv.year} ${rv.make} ${rv.model} (${rv.type}) — Monthly Loan Payment` : `${rv.type || "Recreational vehicle"} — Monthly Loan Payment`}>
                <div className="flex items-center justify-between bg-slate-700/60 border border-green-500/40 rounded-lg px-3 py-2">
                  <span className="text-green-400 font-semibold text-sm">${(parseFloat(rv.monthlyPayment)||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}/mo</span>
                  <span className="text-xs text-slate-500">auto-filled from Recreational Vehicles</span>
                </div>
              </Field>
            ))}
            {/* Other-secured-creditor payments tied to a vehicle / RV
                collateral (e.g., a co-signed car loan added on Schedule D).
                These also belong in Schedule J transportation. Read-only —
                source of truth is the Schedule D other-secured list. */}
            {(data.otherSecuredCreditors || []).filter(sc => (sc.collateralAssetKey || "").startsWith("vehicle:") || (sc.collateralAssetKey || "").startsWith("rv:")).filter(sc => parseFloat(sc.monthlyPayment) > 0).map((sc) => (
              <Field key={`osc-v-${sc.id}`} label={`${sc.collateralDescription || "Other secured vehicle creditor"} — Monthly Payment`}>
                <div className="flex items-center justify-between bg-slate-700/60 border border-green-500/40 rounded-lg px-3 py-2">
                  <span className="text-green-400 font-semibold text-sm">${(parseFloat(sc.monthlyPayment)||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}/mo</span>
                  <span className="text-xs text-slate-500">auto-filled from Schedule D ({sc.creditorName || "creditor"})</span>
                </div>
              </Field>
            ))}
          </SectionCard>

          {/* Other Secured Payments — auto-pulled from Schedule D when the
              client added "other secured creditors" with monthly payments
              and the collateral wasn't a vehicle or RV (those land in
              Transportation above). Avoids re-asking. */}
          {(() => {
            const otherSecured = (data.otherSecuredCreditors || []).filter(sc => {
              const key = sc.collateralAssetKey || "";
              const monthly = parseFloat(sc.monthlyPayment) || 0;
              return monthly > 0 && !key.startsWith("vehicle:") && !key.startsWith("rv:") && !key.startsWith("realProperty:");
            });
            if (data.securedListComplete !== "no" || otherSecured.length === 0) return null;
            return (
              <SectionCard title="Other Secured Creditor Payments" icon="🔒">
                <p className="text-base text-white font-bold mb-2">These payments came from <strong className="text-amber-400">Schedule D</strong> — you do <strong className="text-amber-400">not</strong> need to re-enter them.</p>
                {otherSecured.map(sc => (
                  <Field key={`osc-other-${sc.id}`} label={`${sc.creditorName || "Other secured creditor"}${sc.collateralDescription ? ` — ${sc.collateralDescription}` : ""}`}>
                    <div className="flex items-center justify-between bg-slate-700/60 border border-green-500/40 rounded-lg px-3 py-2">
                      <span className="text-green-400 font-semibold text-sm">${(parseFloat(sc.monthlyPayment)||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}/mo</span>
                      <span className="text-xs text-slate-500">auto-filled from Schedule D</span>
                    </div>
                  </Field>
                ))}
              </SectionCard>
            );
          })()}

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
            {(() => {
              // Auto-pull ongoing child support / alimony payments from the
              // Priority Debts section. Only direct-paid (or "both") amounts
              // belong on Schedule J; paycheck-deducted amounts are already
              // netted out of gross income on the paystub and would
              // double-count as an expense if shown here.
              const csEntries = (data.priorityDebts || []).filter(d => d.type === "back_child_support" && parseFloat(d.monthlyPayment) > 0 && d.paymentMethod);
              const alEntries = (data.priorityDebts || []).filter(d => d.type === "back_alimony" && parseFloat(d.monthlyPayment) > 0 && d.paymentMethod);

              const renderEntry = (d, label) => {
                const amount = parseFloat(d.monthlyPayment) || 0;
                const directOrBoth = d.paymentMethod === "direct" || d.paymentMethod === "both";
                return (
                  <Field key={d.id} label={`${label}${d.creditor ? ` — ${d.creditor}` : ""}`}>
                    {directOrBoth ? (
                      <div className="flex items-center justify-between bg-slate-700/60 border border-green-500/40 rounded-lg px-3 py-2">
                        <span className="text-green-400 font-semibold text-sm">${amount.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}/mo</span>
                        <span className="text-xs text-slate-500">{d.paymentMethod === "both" ? "auto-filled from Schedule E — partly paid directly" : "auto-filled from Schedule E — paid directly"}</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between bg-slate-800/60 border border-slate-600 rounded-lg px-3 py-2">
                        <span className="text-slate-500 text-xs italic">${amount.toLocaleString()}/mo — wage-deducted, NOT a Schedule J expense</span>
                        <span className="text-xs text-slate-500">from paycheck</span>
                      </div>
                    )}
                  </Field>
                );
              };

              if (csEntries.length === 0 && alEntries.length === 0) {
                return (
                  <>
                    <ExpenseField label="Ongoing Child Support Paid (monthly — paid outside any plan)" error={e("expAlimonyPaid")} value={data.expAlimonyPaid} onChange={v=>u("expAlimonyPaid",v)}/>
                    <ExpenseField label="Ongoing Alimony / Spousal Support Paid (monthly — paid outside any plan)" error={e("expSupportOthers")} value={data.expSupportOthers} onChange={v=>u("expSupportOthers",v)}/>
                  </>
                );
              }
              return (
                <>
                  {csEntries.map(d => renderEntry(d, "Ongoing Child Support Paid"))}
                  {alEntries.map(d => renderEntry(d, "Ongoing Alimony / Spousal Support Paid"))}
                  {csEntries.length === 0 && (
                    <ExpenseField label="Ongoing Child Support Paid (monthly — paid outside any plan)" error={e("expAlimonyPaid")} value={data.expAlimonyPaid} onChange={v=>u("expAlimonyPaid",v)}/>
                  )}
                  {alEntries.length === 0 && (
                    <ExpenseField label="Ongoing Alimony / Spousal Support Paid (monthly — paid outside any plan)" error={e("expSupportOthers")} value={data.expSupportOthers} onChange={v=>u("expSupportOthers",v)}/>
                  )}
                </>
              );
            })()}
          </SectionCard>
          <SectionCard title="Other Monthly Expenses" icon="📋">
            <ExpenseField label="Recreation & Entertainment" error={e("expRecreation")} value={data.expRecreation} onChange={v=>u("expRecreation",v)}/>
            <ExpenseField label="Charitable Contributions" error={e("expCharitable")} value={data.expCharitable} onChange={v=>u("expCharitable",v)}/>
            {(() => {
              // Auto-pull IRS / state tax installment payments from priority
              // debts. Direct-pay only — wage-deducted (e.g., voluntary
              // additional withholding) is already netted out of gross income.
              const taxEntries = (data.priorityDebts || []).filter(d => d.type === "back_taxes" && parseFloat(d.monthlyPayment) > 0 && d.paymentMethod);
              if (taxEntries.length === 0) {
                return <ExpenseField label="Additional Tax Payments" error={e("expAddlTaxes")} value={data.expAddlTaxes} onChange={v=>u("expAddlTaxes",v)}/>;
              }
              return (
                <>
                  {taxEntries.map(d => {
                    const amount = parseFloat(d.monthlyPayment) || 0;
                    const directOrBoth = d.paymentMethod === "direct" || d.paymentMethod === "both";
                    return (
                      <Field key={d.id} label={`Tax Installment — ${d.creditor || `${d.taxYear || ""} Tax Year`}`}>
                        {directOrBoth ? (
                          <div className="flex items-center justify-between bg-slate-700/60 border border-green-500/40 rounded-lg px-3 py-2">
                            <span className="text-green-400 font-semibold text-sm">${amount.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}/mo</span>
                            <span className="text-xs text-slate-500">{d.paymentMethod === "both" ? "auto-filled from Schedule E — partly paid directly" : "auto-filled from Schedule E — paid directly"}</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between bg-slate-800/60 border border-slate-600 rounded-lg px-3 py-2">
                            <span className="text-slate-500 text-xs italic">${amount.toLocaleString()}/mo — wage-deducted, NOT a Schedule J expense</span>
                            <span className="text-xs text-slate-500">from paycheck</span>
                          </div>
                        )}
                      </Field>
                    );
                  })}
                </>
              );
            })()}
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
          {/* Schedule D — Secured Consumer Debts.
              Auto-aggregates secured creditors disclosed in earlier sections:
                • Real-property mortgages (primary + second)
                • Financed vehicles
                • Financed recreational vehicles
              Then asks if the auto-list is complete. If not, the client adds
              additional secured creditors (judgment liens, IRS liens, security
              agreements on personal property, family-co-signed loans, etc.)
              via otherSecuredCreditors[]. We don't re-ask balance/payment for
              items the client already entered — the displayed amounts are
              read-only summaries of those prior answers. */}
          <SectionCard title="Secured Consumer Debts — Schedule D" icon="🔒">
            {(() => {
              const securedRows = [];
              const num = (v) => parseFloat(v) || 0;

              // Primary residence mortgage
              if (data.ownsRealEstate === "yes" && (num(data.mortgageBalance) > 0 || num(data.realPropMonthlyPayment) > 0)) {
                securedRows.push({
                  source: "Real Property",
                  creditor: data.mortgageLender || "Primary mortgage lender",
                  collateral: data.realPropAddress || "Primary residence",
                  balance: num(data.mortgageBalance),
                  monthlyPayment: num(data.realPropMonthlyPayment),
                  arrears: num(data.mortgageArrears),
                });
              }
              // Second property mortgage
              if (data.secondProperty === "yes" && (num(data.secondMortgage) > 0 || num(data.secondMortgagePayment) > 0)) {
                securedRows.push({
                  source: "Real Property",
                  creditor: data.secondMortgageLender || "Second-property mortgage lender",
                  collateral: data.secondPropAddress || "Second / investment property",
                  balance: num(data.secondMortgage),
                  monthlyPayment: num(data.secondMortgagePayment),
                  arrears: num(data.secondMortgageArrears),
                });
              }
              // Property liens (judgment / tax / HOA liens disclosed under real property)
              if (data.hasLiens === "yes") {
                (data.liens || []).forEach((l) => {
                  if (num(l.balance) > 0 || num(l.monthlyPayment) > 0) {
                    securedRows.push({
                      source: "Real Property — Lien",
                      creditor: l.lienHolder || "Lien holder",
                      collateral: l.lienType || "Real property lien",
                      balance: num(l.balance),
                      monthlyPayment: num(l.monthlyPayment),
                      arrears: 0,
                    });
                  }
                });
              }
              // Financed vehicles
              if (data.hasVehicles === "yes") {
                (data.vehicles || []).forEach((v) => {
                  if (v.hasLoan === "yes" && (num(v.loanBalance) > 0 || num(v.monthlyPayment) > 0)) {
                    securedRows.push({
                      source: "Vehicle",
                      creditor: v.lenderName || "Vehicle lender",
                      collateral: `${v.year || ""} ${v.make || ""} ${v.model || ""}`.trim() || "Vehicle",
                      balance: num(v.loanBalance),
                      monthlyPayment: num(v.monthlyPayment),
                      arrears: 0,
                    });
                  }
                });
              }
              // Financed recreational vehicles
              if (data.hasRecreationalVehicles === "yes") {
                (data.recreationalVehicles || []).forEach((rv) => {
                  if (rv.hasLoan === "yes" && (num(rv.loanBalance) > 0 || num(rv.monthlyPayment) > 0)) {
                    securedRows.push({
                      source: "Recreational",
                      creditor: rv.lenderName || "Lender",
                      collateral: `${rv.year || ""} ${rv.make || ""} ${rv.model || ""}`.trim() || rv.type || "Recreational vehicle",
                      balance: num(rv.loanBalance),
                      monthlyPayment: num(rv.monthlyPayment),
                      arrears: 0,
                    });
                  }
                });
              }

              const totalBalance = securedRows.reduce((a, r) => a + r.balance, 0);

              return (
                <>
                  <p className="text-sm font-semibold text-white mb-1">Do you have any secured debts?</p>
                  <p className="text-[11px] text-slate-400 mb-3">
                    <strong className="text-amber-400">Secured debts</strong> have something backing them — like a house, car, or boat. We already pulled these in from earlier — you do <strong className="text-white">not</strong> need to enter them again.
                  </p>

                  {securedRows.length === 0 ? (
                    <div className="p-3 bg-slate-800/40 border border-slate-700 rounded-xl text-xs text-slate-500 italic mb-3">
                      No secured creditors auto-pulled from earlier sections. If you have any secured debts, add them below.
                    </div>
                  ) : (
                    <div className="border border-slate-700 rounded-xl overflow-hidden mb-3">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-800/60">
                          <tr className="text-left text-slate-400 uppercase tracking-widest text-[10px]">
                            <th className="px-3 py-2">Creditor</th>
                            <th className="px-3 py-2">Collateral</th>
                            <th className="px-3 py-2 text-right">Balance</th>
                            <th className="px-3 py-2 text-right">Monthly</th>
                          </tr>
                        </thead>
                        <tbody>
                          {securedRows.map((r, idx) => (
                            <tr key={idx} className="border-t border-slate-700/60 text-slate-200">
                              <td className="px-3 py-2">
                                <div className="font-semibold">{r.creditor}</div>
                                <div className="text-[10px] text-slate-500 uppercase tracking-widest">{r.source}</div>
                              </td>
                              <td className="px-3 py-2 text-slate-300">{r.collateral}</td>
                              <td className="px-3 py-2 text-right tabular-nums">${r.balance.toLocaleString("en-US",{maximumFractionDigits:0})}{r.arrears > 0 && <div className="text-[10px] text-amber-400">+${r.arrears.toLocaleString()} arrears</div>}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-slate-400">{r.monthlyPayment > 0 ? `$${r.monthlyPayment.toLocaleString()}/mo` : "—"}</td>
                            </tr>
                          ))}
                          <tr className="border-t border-slate-600 bg-slate-800/40 font-bold">
                            <td className="px-3 py-2 text-slate-300" colSpan={2}>Total secured balance</td>
                            <td className="px-3 py-2 text-right tabular-nums text-amber-400" colSpan={2}>${totalBalance.toLocaleString("en-US",{maximumFractionDigits:0})}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Mortgage PITI question lives in the Real Estate section
                      (Schedule A/B) alongside the mortgage creditor + monthly
                      payment. The same `mortgageIncludesInsurance` state
                      carries the answer over to Schedule J. */}

                  {/* Vehicle-specific confirmation — user request: ask if there
                      are any OTHER vehicle loans (e.g., co-signed, family member
                      on title, vehicle not yet disclosed). */}
                  <Field label="Do you owe any OTHER vehicle / recreational-vehicle loans not already listed above?" error={e("hasOtherVehicleLoans")}>
                    <RadioGroup name="hasOtherVehicleLoans"
                      current={data.hasOtherVehicleLoans}
                      onChange={v=>u("hasOtherVehicleLoans",v)}
                      error={e("hasOtherVehicleLoans")}
                      options={[
                        {value:"no",label:"No — the vehicles / recreational items listed above are all of them"},
                        {value:"yes",label:"Yes — I have other vehicle loans not listed (e.g., co-signed)"},
                      ]}/>
                  </Field>
                  {data.hasOtherVehicleLoans === "yes" && (
                    <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[11px] text-amber-400">
                      Please go back to the <strong>Vehicles</strong> or <strong>Recreational Vehicles</strong> section above and add the missing loan(s). Auto-pulled items are the source of truth — adding them in the right section keeps Schedule J and the vehicle valuation consistent.
                    </div>
                  )}

                  {/* General confirmation — does the auto-list cover everything? */}
                  <Field label="Does the list above include ALL of your secured creditors?" error={e("securedListComplete")}>
                    <RadioGroup name="securedListComplete"
                      current={data.securedListComplete}
                      onChange={v=>u("securedListComplete",v)}
                      error={e("securedListComplete")}
                      options={[
                        {value:"yes",label:"Yes — these are all of my secured creditors"},
                        {value:"no",label:"No — I have additional secured creditors to add"},
                      ]}/>
                  </Field>

                  {data.securedListComplete === "no" && (() => {
                    // Build collateral options from previously-listed assets.
                    // Each option's value is a stable key the client picks; the
                    // label is what they see; the description prop is the
                    // human-readable text we stash into collateralDescription
                    // so PDFs / Schedule D show the right collateral name.
                    const collateralOptions = [];
                    if (data.ownsRealEstate === "yes" && (data.realPropAddress || data.mortgageBalance)) {
                      collateralOptions.push({ value: "realProperty:primary", label: `🏠 Primary home — ${data.realPropAddress || "the home you listed"}` });
                    }
                    if (data.secondProperty === "yes" && (data.secondPropAddress || data.secondMortgage)) {
                      collateralOptions.push({ value: "realProperty:second", label: `🏡 Second property — ${data.secondPropAddress || "the second property you listed"}` });
                    }
                    if (data.hasVehicles === "yes") {
                      (data.vehicles || []).forEach((v, vi) => {
                        const desc = `${v.year || ""} ${v.make || ""} ${v.model || ""}`.trim();
                        if (desc) collateralOptions.push({ value: `vehicle:${vi}`, label: `🚗 ${desc}` });
                      });
                    }
                    if (data.hasRecreationalVehicles === "yes") {
                      (data.recreationalVehicles || []).forEach((rv, ri) => {
                        const desc = `${rv.year || ""} ${rv.make || ""} ${rv.model || ""}`.trim() || rv.type;
                        if (desc) collateralOptions.push({ value: `rv:${ri}`, label: `🛥️ ${desc}` });
                      });
                    }
                    // Generic asset categories
                    if (parseFloat(data.householdGoodsValue) > 0 || data.noHouseholdGoods === false) collateralOptions.push({ value: "category:household_goods", label: "🛋️ Household goods / furniture" });
                    if (parseFloat(data.electronicsValue) > 0) collateralOptions.push({ value: "category:electronics", label: "📺 Electronics" });
                    if (parseFloat(data.jewelryValue) > 0) collateralOptions.push({ value: "category:jewelry", label: "💍 Jewelry" });
                    if (parseFloat(data.toolsValue) > 0) collateralOptions.push({ value: "category:tools", label: "🔧 Tools / equipment" });
                    if (data.hasFirearms === "yes") collateralOptions.push({ value: "category:firearms", label: "🔫 Firearms" });
                    if (data.hasCollectibles === "yes") collateralOptions.push({ value: "category:collectibles", label: "🎨 Collectibles" });
                    if (data.hasBusinessAssets === "yes") collateralOptions.push({ value: "category:business_assets", label: "🏭 Business assets / equipment" });
                    collateralOptions.push({ value: "other", label: "📦 Other — something not listed yet" });

                    const labelForKey = (key) => collateralOptions.find(o => o.value === key)?.label?.replace(/^[^\s]+\s/, "") || "";

                    return (
                      <div className="mt-2">
                        <p className="text-[11px] text-slate-400 mb-2">
                          Add any <strong className="text-amber-400">other secured creditors</strong> (judgment liens, IRS / state tax liens, pawn loans, security agreements on furniture or electronics, etc.).
                        </p>
                        {(data.otherSecuredCreditors || []).map((sc, i) => (
                          <div key={sc.id} className="border border-slate-700 rounded-xl p-3 mb-2 bg-slate-800/40">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold text-slate-300">Other Secured Creditor #{i+1}</span>
                              {(data.otherSecuredCreditors || []).length > 1 && (
                                <button type="button"
                                  onClick={()=>u("otherSecuredCreditors", data.otherSecuredCreditors.filter(x => x.id !== sc.id))}
                                  className="text-xs text-red-400 hover:text-red-300 underline">Remove</button>
                              )}
                            </div>
                            <Field label="Who is the creditor?">
                              <Input value={sc.creditorName || ""}
                                onChange={v=>u("otherSecuredCreditors", data.otherSecuredCreditors.map((x,idx)=>idx===i?{...x,creditorName:v}:x))}
                                placeholder="e.g., Wells Fargo, IRS, John Smith"/>
                            </Field>
                            {/* Collateral picker — links the lien to an asset
                                the client already listed. Picking "Other"
                                opens the free-text input for new property. */}
                            <Field label="What does this debt have a lien on?">
                              <Select
                                value={sc.collateralAssetKey || ""}
                                onChange={v=>{
                                  // When picking a listed asset, snap the
                                  // collateralDescription to that asset's
                                  // human-readable label so downstream
                                  // PDF/Schedule D output is consistent.
                                  const descFromKey = v === "other" ? (sc.collateralDescription || "") : labelForKey(v);
                                  u("otherSecuredCreditors", data.otherSecuredCreditors.map((x,idx)=>idx===i?{...x,collateralAssetKey:v,collateralDescription:descFromKey}:x));
                                }}
                                options={collateralOptions}
                                placeholder="Pick the property this lien is on..."/>
                            </Field>
                            {sc.collateralAssetKey === "other" && (
                              <Field label="Describe the property the lien is on">
                                <Input value={sc.collateralDescription || ""}
                                  onChange={v=>u("otherSecuredCreditors", data.otherSecuredCreditors.map((x,idx)=>idx===i?{...x,collateralDescription:v}:x))}
                                  placeholder="e.g., Living room set from Aaron's, business inventory"/>
                              </Field>
                            )}
                            <div className="grid grid-cols-2 gap-3">
                              <Field label="How much do you owe?">
                                <Input type="number" value={sc.balance || ""}
                                  onChange={v=>u("otherSecuredCreditors", data.otherSecuredCreditors.map((x,idx)=>idx===i?{...x,balance:v}:x))}
                                  placeholder="Enter amount"/>
                              </Field>
                              <Field label="Monthly payment (if any)">
                                <Input type="number" value={sc.monthlyPayment || ""}
                                  onChange={v=>u("otherSecuredCreditors", data.otherSecuredCreditors.map((x,idx)=>idx===i?{...x,monthlyPayment:v}:x))}
                                  placeholder="Enter amount or 0"/>
                              </Field>
                            </div>
                          </div>
                        ))}
                        <button type="button"
                          onClick={()=>u("otherSecuredCreditors", [...(data.otherSecuredCreditors || []), { id: Date.now(), creditorName:"", collateralAssetKey:"", collateralDescription:"", balance:"", monthlyPayment:"" }])}
                          className="w-full border border-dashed border-amber-400/40 hover:border-amber-400 text-amber-400 text-xs font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2">
                          <span className="text-base">+</span> Add Another Secured Creditor
                        </button>
                      </div>
                    );
                  })()}
                </>
              );
            })()}
          </SectionCard>

          {/* Schedule E — Priority Debts (back taxes, back child support, back alimony).
              Listed AFTER Schedule D per Bankruptcy Code ordering (D → E → F).
              Each entry carries paymentMethod ("direct" | "paycheck" | "both")
              so Schedule J knows whether the ongoing payment is wage-deducted
              (already netted out of gross income) or paid out-of-pocket (true
              Schedule J expense). The attorney-side analyzer reads priorityDebts[]
              (by balance) and surfaces unfiled-tax entries as an attorney issue. */}
          <SectionCard title="Priority Debts — Schedule E" icon="⚖️">
            <p className="text-sm font-semibold text-white mb-1">Do you owe any priority debts?</p>
            <p className="text-[11px] text-slate-400 mb-3">
              <strong className="text-amber-400">Priority debts</strong> are special debts the law treats first — <strong className="text-white">back taxes</strong>, <strong className="text-white">past-due child support</strong>, and <strong className="text-white">past-due alimony</strong>.
            </p>
            {data.hasPriorityDebt !== "yes" && (
              <button onClick={()=>u("hasPriorityDebt","no")}
                className={`w-full flex items-center justify-center gap-3 px-4 py-4 rounded-xl border-2 font-bold text-sm transition-all mb-3 ${data.hasPriorityDebt==="no"?"bg-green-500/20 border-green-500 text-green-300":"bg-slate-800/60 border-dashed border-slate-500 text-slate-300 hover:border-amber-400 hover:text-amber-400"}`}>
                {data.hasPriorityDebt==="no" ? <>✓ Acknowledged — I have no priority creditors</> : <>⚖️ I do not owe any back taxes, back child support, or back alimony — click to confirm</>}
              </button>
            )}
            {data.hasPriorityDebt==="no" && (
              <button onClick={()=>u("hasPriorityDebt","")} className="w-full text-xs text-slate-400 hover:text-amber-400 underline mb-2 text-center">I do have priority debts — click to enter them</button>
            )}
            {data.hasPriorityDebt !== "no" && (
              <>
                {data.hasPriorityDebt !== "yes" && (
                  <button onClick={()=>u("hasPriorityDebt","yes")} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-amber-400/50 text-amber-400 hover:bg-amber-400/10 font-semibold text-sm transition-all mb-3">
                    <span>+</span> I owe priority debts — enter them below
                  </button>
                )}
                {data.hasPriorityDebt==="yes" && (
                  <>
                    {(data.priorityDebts || []).map((d, i) => (
                      <div key={d.id} className="border border-slate-700 rounded-xl p-3 mb-3 bg-slate-800/40">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-semibold text-slate-300">Priority Debt #{i+1}</span>
                          {(data.priorityDebts || []).length > 1 && (
                            <button type="button"
                              onClick={()=>u("priorityDebts", data.priorityDebts.filter(x => x.id !== d.id))}
                              className="text-xs text-red-400 hover:text-red-300 underline">Remove</button>
                          )}
                        </div>

                        <Field label="Type of priority debt" error={e(`priority_${i}_type`)}>
                          <Select
                            value={d.type}
                            onChange={v=>u("priorityDebts", data.priorityDebts.map((x,idx)=>idx===i?{...x,type:v,taxYear:"",taxFiled:"",monthlyPayment:"",paymentMethod:""}:x))}
                            options={["Back Taxes (IRS / State)","Back Child Support","Back Alimony / Spousal Support"].map(label=>{
                              const v = label==="Back Taxes (IRS / State)" ? "back_taxes" : label==="Back Child Support" ? "back_child_support" : "back_alimony";
                              return { value:v, label };
                            })}
                            placeholder="Select type…"
                          />
                        </Field>

                        {d.type === "back_taxes" && (
                          <div className="mt-2 space-y-2">
                            <Field label="Tax Year" error={e(`priority_${i}_taxYear`)}>
                              <Input type="number" value={d.taxYear || ""}
                                onChange={v=>u("priorityDebts", data.priorityDebts.map((x,idx)=>idx===i?{...x,taxYear:v,creditor:`IRS / State — ${v} Tax Year`}:x))}
                                placeholder="e.g., 2022"/>
                            </Field>
                            <Field label="Amount Owed for this Tax Year" error={e(`priority_${i}_amount`)}>
                              <Input type="number" value={d.amount || ""}
                                onChange={v=>u("priorityDebts", data.priorityDebts.map((x,idx)=>idx===i?{...x,amount:v,balance:v}:x))}
                                placeholder="Enter amount"/>
                            </Field>
                            <Field label="Was the tax return for this year FILED with the IRS / State?" error={e(`priority_${i}_taxFiled`)}>
                              <div className="flex gap-2">
                                {[{v:"yes",label:"Yes — Return Filed"},{v:"no",label:"No — Return NOT Filed"}].map(opt=>(
                                  <button key={opt.v} type="button"
                                    onClick={()=>u("priorityDebts", data.priorityDebts.map((x,idx)=>idx===i?{...x,taxFiled:opt.v}:x))}
                                    className={`flex-1 text-xs py-2.5 rounded-xl border font-medium transition-all ${d.taxFiled===opt.v ? (opt.v==="no" ? "bg-red-600 border-red-500 text-white" : "bg-blue-600 border-blue-500 text-white") : "bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200"}`}
                                  >{opt.label}</button>
                                ))}
                              </div>
                            </Field>
                            {d.taxFiled === "no" && (
                              <div className="p-3 bg-red-500/10 border border-red-500/40 rounded-lg">
                                <p className="text-[11px] text-red-300 font-semibold mb-1">⚠️ Attorney Review Required</p>
                                <p className="text-[11px] text-red-200/90">
                                  Unfiled tax returns are flagged for attorney review. Tax returns for the <strong>4 most recent tax years</strong> must
                                  generally be filed with the IRS before bankruptcy. Your attorney will advise you to file these returns —
                                  in many cases <strong>before the petition is filed</strong> — to avoid dismissal or discharge issues.
                                </p>
                              </div>
                            )}
                            <Field label="Are you currently making monthly payments toward this tax debt?" error={e(`priority_${i}_monthlyPayment`)}>
                              <Input type="number" value={d.monthlyPayment || ""}
                                onChange={v=>u("priorityDebts", data.priorityDebts.map((x,idx)=>idx===i?{...x,monthlyPayment:v}:x))}
                                placeholder="Enter monthly amount (or 0 if not paying)"/>
                            </Field>
                          </div>
                        )}

                        {(d.type === "back_child_support" || d.type === "back_alimony") && (
                          <div className="mt-2 space-y-2">
                            <Field label="Payee / Creditor (optional)">
                              <Input value={d.creditor || ""}
                                onChange={v=>u("priorityDebts", data.priorityDebts.map((x,idx)=>idx===i?{...x,creditor:v}:x))}
                                placeholder={d.type === "back_child_support" ? "e.g., Jane Doe / Maricopa County DCSS" : "e.g., John Doe"}/>
                            </Field>
                            <Field label="Total Past-Due Amount" error={e(`priority_${i}_amount`)}>
                              <Input type="number" value={d.amount || ""}
                                onChange={v=>u("priorityDebts", data.priorityDebts.map((x,idx)=>idx===i?{...x,amount:v,balance:v}:x))}
                                placeholder="Enter total arrears amount"/>
                            </Field>
                            <Field label="Going-Forward Monthly Payment" error={e(`priority_${i}_monthlyPayment`)}>
                              <Input type="number" value={d.monthlyPayment || ""}
                                onChange={v=>u("priorityDebts", data.priorityDebts.map((x,idx)=>idx===i?{...x,monthlyPayment:v}:x))}
                                placeholder="Enter current monthly payment"/>
                            </Field>
                          </div>
                        )}

                        {/* Payment method — applies to ALL priority debt types.
                            Drives Schedule J de-duplication: if the obligation
                            is wage-deducted, it already nets out of gross income
                            on the paystub and should NOT appear as a Schedule J
                            expense. Direct-pay items DO appear on Schedule J. */}
                        {d.type && parseFloat(d.monthlyPayment) > 0 && (
                          <div className="mt-3 pt-3 border-t border-slate-700/60">
                            <Field label="How is this monthly payment made?" error={e(`priority_${i}_paymentMethod`)}>
                              <div className="flex flex-col gap-2">
                                {[
                                  {v:"direct",label:"Paid directly to the creditor (out of pocket)"},
                                  {v:"paycheck",label:"Deducted from my paycheck / wage garnishment"},
                                  {v:"both",label:"Both — part wage-deducted, part paid directly"},
                                ].map(opt=>(
                                  <button key={opt.v} type="button"
                                    onClick={()=>u("priorityDebts", data.priorityDebts.map((x,idx)=>idx===i?{...x,paymentMethod:opt.v}:x))}
                                    className={`text-xs py-2.5 px-3 rounded-xl border font-medium transition-all text-left ${d.paymentMethod===opt.v ? "bg-blue-600 border-blue-500 text-white" : "bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200"}`}
                                  >{opt.label}</button>
                                ))}
                              </div>
                            </Field>
                            {d.paymentMethod === "paycheck" && (
                              <p className="text-[11px] text-blue-200 mt-1.5">
                                <strong className="text-blue-300">Got it.</strong> Since it comes out of your paycheck, we <strong className="text-white">won't double-count it</strong> on your expenses.
                              </p>
                            )}
                            {d.paymentMethod === "direct" && (
                              <p className="text-[11px] text-blue-200 mt-1.5">
                                <strong className="text-blue-300">Got it.</strong> We'll add this to your <strong className="text-white">monthly expenses</strong> automatically.
                              </p>
                            )}
                          </div>
                        )}

                        {(d.type === "back_child_support" || d.type === "back_alimony") && (
                          <p className="text-[11px] text-blue-400/80 mt-2">
                            Arrears are paid as a priority claim through your Ch. 13 plan. Your ongoing monthly payment continues outside the plan.
                          </p>
                        )}
                      </div>
                    ))}

                    <button type="button"
                      onClick={()=>u("priorityDebts", [...(data.priorityDebts || []), { id: Date.now(), type:"", creditor:"", amount:"", balance:"", taxYear:"", taxFiled:"", monthlyPayment:"", paymentMethod:"" }])}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-amber-400/50 text-amber-400 hover:bg-amber-400/10 font-semibold text-xs transition-all mb-2">
                      + Add Another Priority Debt
                    </button>

                    <div className="mt-3 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                      <p className="text-[11px] text-amber-200/95">
                        <strong className="text-amber-400">Important:</strong> Chapter 7 does <strong className="text-white">not</strong> wipe these out. You may need <strong className="text-amber-400">Chapter 13</strong> to pay them off over <strong className="text-white">3–5 years</strong>.
                      </p>
                    </div>
                  </>
                )}
              </>
            )}
          </SectionCard>

          <SectionCard title="Unsecured Consumer Debts — Schedule F" icon="💳">
            <p className="text-sm font-semibold text-white mb-1">Do you have any unsecured consumer debts?</p>
            <p className="text-[11px] text-slate-400 mb-2">
              <strong className="text-amber-400">Unsecured debts</strong> have <strong className="text-white">nothing backing them</strong> — like credit cards, medical bills, personal loans, and judgments. Enter the balance for each, or tap <strong className="text-slate-300">I don't have this</strong>.
            </p>
            <p className="text-[10px] text-slate-500 mb-3 italic">Back taxes and back child support / alimony belong in <strong className="text-amber-400/80">Priority Debts</strong> above — not here.</p>

            {[
              {key:"creditCardDebt", noKey:"noCreditCardDebt", label:"Credit Card Debt", hint:null},
              {key:"medicalDebt", noKey:"noMedicalDebt", label:"Medical Bills", hint:null},
              {key:"studentLoanDebt", noKey:"noStudentLoanDebt", label:"Student Loans", hint:null},
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

            {/* Friends / family debt — these creditors are INSIDERS for SOFA
                purposes. Each entry's "paid in last 12 months" amount feeds
                the SOFA insider-preferences section so the client doesn't
                re-enter the same info twice. */}
            <div className="mt-4 pt-4 border-t border-slate-700/60">
              <Field label="Do you owe money to any friends or family members?" hint="Example: a loan from your parents, a sibling who covered a bill, a friend who helped with rent." error={e("hasFriendsFamilyDebt")}>
                <RadioGroup name="hasFriendsFamilyDebt" current={data.hasFriendsFamilyDebt}
                  onChange={v=>u("hasFriendsFamilyDebt", v)} error={e("hasFriendsFamilyDebt")}
                  options={[{value:"yes",label:"Yes — I owe friends or family"},{value:"no",label:"No"}]}/>
              </Field>
              {data.hasFriendsFamilyDebt === "yes" && (
                <div className="mt-2 space-y-2">
                  {(data.friendsFamilyDebtEntries || []).map((ff, i) => (
                    <div key={ff.id} className="bg-slate-900/60 border border-amber-400/30 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">Friend / Family #{i+1}</p>
                        {(data.friendsFamilyDebtEntries || []).length > 1 && (
                          <button type="button"
                            onClick={()=>u("friendsFamilyDebtEntries", data.friendsFamilyDebtEntries.filter(x => x.id !== ff.id))}
                            className="text-xs text-red-400 hover:text-red-300 underline">Remove</button>
                        )}
                      </div>
                      <Field label="Who do you owe?" error={errors[`ff_${i}_name`]}>
                        <Input value={ff.name || ""}
                          onChange={v=>u("friendsFamilyDebtEntries", data.friendsFamilyDebtEntries.map((x,idx)=>idx===i?{...x,name:v}:x))}
                          placeholder="Full name"
                          hasError={!!errors[`ff_${i}_name`]}/>
                      </Field>
                      <Field label="How are they related to you?" error={errors[`ff_${i}_relationship`]}>
                        <Input value={ff.relationship || ""}
                          onChange={v=>u("friendsFamilyDebtEntries", data.friendsFamilyDebtEntries.map((x,idx)=>idx===i?{...x,relationship:v}:x))}
                          placeholder="e.g. Mother, Brother, Best friend"
                          hasError={!!errors[`ff_${i}_relationship`]}/>
                      </Field>
                      <Field label="How much do you owe them?" error={errors[`ff_${i}_amountOwed`]}>
                        <Input type="number" value={ff.amountOwed || ""}
                          onChange={v=>u("friendsFamilyDebtEntries", data.friendsFamilyDebtEntries.map((x,idx)=>idx===i?{...x,amountOwed:v}:x))}
                          placeholder="Enter amount"
                          hasError={!!errors[`ff_${i}_amountOwed`]}/>
                      </Field>
                      <Field label="How much have you paid them in the last 12 months?" hint="Even $0 is fine — but the trustee asks because payments to insiders within 1 year can be recovered." error={errors[`ff_${i}_paidLast12Months`]}>
                        <Input type="number" value={ff.paidLast12Months || ""}
                          onChange={v=>u("friendsFamilyDebtEntries", data.friendsFamilyDebtEntries.map((x,idx)=>idx===i?{...x,paidLast12Months:v}:x))}
                          placeholder="Enter total paid in last 12 mo (or 0)"
                          hasError={!!errors[`ff_${i}_paidLast12Months`]}/>
                      </Field>
                      {parseFloat(ff.paidLast12Months) > 0 && (
                        <div className="mt-1 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                          <p className="text-sm text-amber-200"><strong className="text-amber-400">Carried to SOFA:</strong> The <strong className="text-white">${parseFloat(ff.paidLast12Months).toLocaleString("en-US",{maximumFractionDigits:2})}</strong> you paid {ff.name || "this person"} in the last 12 months will appear in the SOFA insider-payments section for you to confirm. <em>You won't need to enter it again.</em></p>
                        </div>
                      )}
                    </div>
                  ))}
                  <button type="button"
                    onClick={()=>u("friendsFamilyDebtEntries", [...(data.friendsFamilyDebtEntries || []), { id: Date.now(), name:"", relationship:"", amountOwed:"", paidLast12Months:"" }])}
                    className="w-full border border-dashed border-amber-400/40 hover:border-amber-400 text-amber-400 text-xs font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2">
                    <span className="text-base">+</span> Add Another Friend / Family Creditor
                  </button>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Business Debts — Schedule F (non-consumer). Moved BELOW consumer
              Schedule F per the new section ordering (Priority → Secured →
              Unsecured Consumer → Business). The five business-bucket fields
              auto-classify as non-consumer in the attorney-side composition
              calc; the dollar amount that lives here drives § 707(b)(1)
              primarily-business-debt analysis. */}
          <SectionCard title="Business Debts — Schedule F" icon="🏢">
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
          {/* Lookback notice — some SOFA questions reach back as far as
              10 years (trust transfers). Clients sometimes leave older
              items off without realizing the lookback windows vary. */}
          <div className="mb-4 p-5 bg-slate-800/60 border border-amber-400/40 rounded-xl">
            <p className="text-base font-bold text-amber-400 mb-2 text-center">Heads up — some questions look back up to 10 years</p>
            <p className="text-base text-white font-bold leading-relaxed">
              Different questions cover different time windows: <strong className="text-amber-400">prior bankruptcies</strong> (8 years), <strong className="text-amber-400">property transfers</strong> (2–4 years), <strong className="text-amber-400">payments to insiders</strong> (1 year), and <strong className="text-amber-400">trust transfers</strong> (up to 10 years).
            </p>
            <p className="text-base text-amber-400 font-bold leading-relaxed mt-2">
              It is important to list <strong>everything</strong> — even old items. Leaving things off can delay or jeopardize your case.
            </p>
          </div>
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
            {/* Auto-flagged secured creditors with monthly payment ≥ $600.
                For each one we already have their monthly amount from earlier
                sections — show 3 × monthly as the expected 90-day total, ask
                the client to confirm, and capture the actual amount if not. */}
            {(() => {
              const num = (v) => parseFloat(v) || 0;
              const securedRows = [];
              if (data.ownsRealEstate === "yes" && num(data.realPropMonthlyPayment) >= 600) {
                securedRows.push({ key:"primary_mortgage", creditor: data.mortgageLender || "Primary mortgage", monthly: num(data.realPropMonthlyPayment) });
              }
              if (data.secondProperty === "yes" && num(data.secondMortgagePayment) >= 600) {
                securedRows.push({ key:"second_mortgage", creditor: data.secondMortgageLender || "Second-property mortgage", monthly: num(data.secondMortgagePayment) });
              }
              if (data.hasVehicles === "yes") {
                (data.vehicles || []).forEach((v, vi) => {
                  if (v.hasLoan === "yes" && num(v.monthlyPayment) >= 600) {
                    const desc = `${v.year || ""} ${v.make || ""} ${v.model || ""}`.trim() || "Vehicle";
                    securedRows.push({ key:`vehicle:${vi}`, creditor: v.lenderName || "Vehicle lender", collateral: desc, monthly: num(v.monthlyPayment) });
                  }
                });
              }
              if (data.hasRecreationalVehicles === "yes") {
                (data.recreationalVehicles || []).forEach((rv, ri) => {
                  if (rv.hasLoan === "yes" && num(rv.monthlyPayment) >= 600) {
                    const desc = `${rv.year || ""} ${rv.make || ""} ${rv.model || ""}`.trim() || rv.type || "Recreational vehicle";
                    securedRows.push({ key:`rv:${ri}`, creditor: rv.lenderName || "Lender", collateral: desc, monthly: num(rv.monthlyPayment) });
                  }
                });
              }

              const setConfirmation = (key, patch) => {
                u("securedPaymentConfirmations", { ...(data.securedPaymentConfirmations || {}), [key]: { ...((data.securedPaymentConfirmations || {})[key] || {}), ...patch } });
              };

              if (securedRows.length === 0) return null;
              return (
                <div className="mb-4 rounded-xl border border-amber-400/40 bg-amber-400/5 p-4">
                  <p className="text-base font-bold text-amber-400 mb-2">Auto-flagged secured-creditor payments</p>
                  <p className="text-sm text-white font-bold mb-3 leading-relaxed">
                    These creditors are <strong className="text-amber-400">paid $600+ per month</strong> based on what you told us earlier. Please confirm whether you actually paid each one over the last 90 days. <em>Example: a $1,500/mo mortgage = $4,500 over 90 days.</em>
                  </p>
                  {securedRows.map(row => {
                    const conf = (data.securedPaymentConfirmations || {})[row.key] || {};
                    const expected = row.monthly * 3;
                    return (
                      <div key={row.key} className="bg-slate-900/60 border border-slate-700 rounded-xl p-3 mb-2">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-sm font-bold text-white">{row.creditor}{row.collateral ? <span className="text-slate-400 font-normal"> · {row.collateral}</span> : null}</p>
                            <p className="text-xs text-slate-400">${row.monthly.toLocaleString("en-US",{maximumFractionDigits:2})}/mo × 3 = <strong className="text-amber-400">${expected.toLocaleString("en-US",{maximumFractionDigits:2})}</strong> expected over 90 days</p>
                          </div>
                        </div>
                        <Field label="Did you pay this creditor the expected amount each month over the last 90 days?">
                          <div className="flex gap-2">
                            <button type="button"
                              onClick={()=>setConfirmation(row.key, { matchesExpected:"yes", actualAmount:String(expected) })}
                              className={`flex-1 text-sm py-2 rounded-lg border font-semibold transition-all ${conf.matchesExpected==="yes" ? "bg-emerald-500/20 border-emerald-500 text-emerald-300" : "bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-500"}`}>
                              ✓ Yes — paid ${expected.toLocaleString()} (accept)
                            </button>
                            <button type="button"
                              onClick={()=>setConfirmation(row.key, { matchesExpected:"no" })}
                              className={`flex-1 text-sm py-2 rounded-lg border font-semibold transition-all ${conf.matchesExpected==="no" ? "bg-amber-500/20 border-amber-500 text-amber-400" : "bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-500"}`}>
                              No — different amount
                            </button>
                          </div>
                        </Field>
                        {conf.matchesExpected === "no" && (
                          <Field label="How much did you actually pay this creditor in the last 90 days?">
                            <Input type="number" value={conf.actualAmount || ""}
                              onChange={v=>setConfirmation(row.key, { actualAmount: v })}
                              placeholder="Enter actual total"/>
                          </Field>
                        )}
                      </div>
                    );
                  })}
                  <Field label="Are there any OTHER creditors you paid over $600 to in the last 90 days that aren't listed above?" hint="Example: paid off a credit card balance, made a lump-sum medical bill payment, or sent a large check to a tax authority.">
                    <RadioGroup name="otherCreditorPaymentsOver600" current={data.otherCreditorPaymentsOver600}
                      onChange={v=>u("otherCreditorPaymentsOver600", v)}
                      options={[{value:"yes",label:"Yes — I paid other creditors over $600"},{value:"no",label:"No"}]}/>
                  </Field>
                  {data.otherCreditorPaymentsOver600 === "yes" && (
                    <div className="mt-2 space-y-2">
                      {(data.otherCreditorPaymentsList || []).map((op, i) => (
                        <div key={op.id} className="bg-slate-900/60 border border-slate-700 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Other Payment #{i+1}</p>
                            {(data.otherCreditorPaymentsList || []).length > 1 && (
                              <button type="button"
                                onClick={()=>u("otherCreditorPaymentsList", data.otherCreditorPaymentsList.filter(x => x.id !== op.id))}
                                className="text-xs text-red-400 hover:text-red-300 underline">Remove</button>
                            )}
                          </div>
                          <Field label="Who did you pay?">
                            <Input value={op.creditor || ""}
                              onChange={v=>u("otherCreditorPaymentsList", data.otherCreditorPaymentsList.map((x,idx)=>idx===i?{...x,creditor:v}:x))}
                              placeholder="e.g. Capital One, IRS, Dr. Smith"/>
                          </Field>
                          <div className="grid grid-cols-2 gap-3">
                            <Field label="Amount paid">
                              <Input type="number" value={op.amount || ""}
                                onChange={v=>u("otherCreditorPaymentsList", data.otherCreditorPaymentsList.map((x,idx)=>idx===i?{...x,amount:v}:x))}
                                placeholder="e.g. 1200"/>
                            </Field>
                            <Field label="When? (MM/YYYY)">
                              <Input value={op.date || ""}
                                onChange={v=>u("otherCreditorPaymentsList", data.otherCreditorPaymentsList.map((x,idx)=>idx===i?{...x,date:v}:x))}
                                placeholder="MM/YYYY"/>
                            </Field>
                          </div>
                        </div>
                      ))}
                      <button type="button"
                        onClick={()=>u("otherCreditorPaymentsList", [...(data.otherCreditorPaymentsList || []), { id: Date.now(), creditor:"", amount:"", date:"" }])}
                        className="w-full border border-dashed border-amber-400/40 hover:border-amber-400 text-amber-400 text-xs font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2">
                        <span className="text-base">+</span> Add Another Payment
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            <Field label="Have you paid $600 or more to any regular creditor in the last 90 days?" hint="Example: a one-time payoff to a credit card, a large catch-up payment to a lender, a big payment to a doctor or hospital — anything beyond your normal monthly bills." error={e("preferentialPayments")}>
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
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400 leading-relaxed">
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
            {/* Auto-pulled from Schedule F friends/family debt entries.
                Anyone the client said they paid > $0 to in the last 12
                months shows up here for confirmation, so they don't have
                to re-enter the same names twice. */}
            {(() => {
              const ffPaid = (data.friendsFamilyDebtEntries || []).filter(ff => parseFloat(ff.paidLast12Months) > 0);
              if (data.hasFriendsFamilyDebt !== "yes" || ffPaid.length === 0) return null;
              return (
                <div className="mb-4 rounded-xl border border-amber-400/40 bg-amber-400/5 p-4">
                  <p className="text-base font-bold text-amber-400 mb-2">Carried over from Schedule F — please confirm</p>
                  <p className="text-sm text-white font-bold mb-3 leading-relaxed">
                    You told us you've paid these friends / family in the last 12 months. Confirm the amounts — they'll be listed as insider payments on the SOFA.
                  </p>
                  {ffPaid.map(ff => (
                    <div key={`ffsofa-${ff.id}`} className="bg-slate-900/60 border border-slate-700 rounded-xl p-3 mb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-white">{ff.name || "—"}{ff.relationship ? <span className="text-slate-400 font-normal"> · {ff.relationship}</span> : null}</p>
                          <p className="text-xs text-slate-400">Paid in last 12 months: <strong className="text-amber-400">${parseFloat(ff.paidLast12Months).toLocaleString("en-US",{maximumFractionDigits:2})}</strong></p>
                        </div>
                        <span className="text-xs text-slate-500 italic">auto-filled from Schedule F</span>
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-slate-400 italic mt-2">If any of these are wrong, edit the friends / family creditors in Schedule F above.</p>
                </div>
              );
            })()}

            <Field label="Have you paid any money to a family member, friend, or other insider in the last 12 months?" hint="Beyond the friends/family creditors above. Example: paying back a parent who lent you money, sending money to a sibling, or paying a business partner." error={e("preferentialPaymentsInsider")}>
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
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400 leading-relaxed">
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
            <Field label="Have you created or transferred assets into a trust in the last 10 years?" hint="Example: putting your house or savings into a family trust, naming yourself or someone else as trustee." error={e("createdTrust")}>
              <RadioGroup name="createdTrust" current={data.createdTrust} onChange={v=>u("createdTrust",v)} error={e("createdTrust")} options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
            </Field>
            {data.createdTrust === "yes" && (
              <div className="mt-2 space-y-2">
                {(data.trustEntries || []).map((t, i) => (
                  <div key={t.id} className="bg-slate-900/60 border border-amber-400/30 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">Trust #{i+1}</p>
                      {(data.trustEntries || []).length > 1 && (
                        <button type="button"
                          onClick={()=>u("trustEntries", data.trustEntries.filter(x => x.id !== t.id))}
                          className="text-xs text-red-400 hover:text-red-300 underline">Remove</button>
                      )}
                    </div>
                    <Field label="Name of the trust" error={errors[`trust_${i}_trustName`]}>
                      <Input value={t.trustName || ""}
                        onChange={v=>u("trustEntries", data.trustEntries.map((x,idx)=>idx===i?{...x,trustName:v}:x))}
                        placeholder="e.g. The Smith Family Living Trust"
                        hasError={!!errors[`trust_${i}_trustName`]}/>
                    </Field>
                    <Field label="What property was transferred into the trust?" error={errors[`trust_${i}_propertyTransferred`]}>
                      <Input value={t.propertyTransferred || ""}
                        onChange={v=>u("trustEntries", data.trustEntries.map((x,idx)=>idx===i?{...x,propertyTransferred:v}:x))}
                        placeholder="e.g. Primary residence, $50,000 savings account, vehicle"
                        hasError={!!errors[`trust_${i}_propertyTransferred`]}/>
                    </Field>
                    <Field label="Value of the property transferred" error={errors[`trust_${i}_propertyValue`]}>
                      <Input type="number" value={t.propertyValue || ""}
                        onChange={v=>u("trustEntries", data.trustEntries.map((x,idx)=>idx===i?{...x,propertyValue:v}:x))}
                        placeholder="Enter amount"
                        hasError={!!errors[`trust_${i}_propertyValue`]}/>
                    </Field>
                    <Field label="Trustee name (who manages the trust)" error={errors[`trust_${i}_trusteeName`]}>
                      <Input value={t.trusteeName || ""}
                        onChange={v=>u("trustEntries", data.trustEntries.map((x,idx)=>idx===i?{...x,trusteeName:v}:x))}
                        placeholder="Full name of the trustee"
                        hasError={!!errors[`trust_${i}_trusteeName`]}/>
                    </Field>
                    <Field label="Beneficiary name(s) (who receives from the trust)" error={errors[`trust_${i}_beneficiaryName`]}>
                      <Input value={t.beneficiaryName || ""}
                        onChange={v=>u("trustEntries", data.trustEntries.map((x,idx)=>idx===i?{...x,beneficiaryName:v}:x))}
                        placeholder="Full name(s) of beneficiaries"
                        hasError={!!errors[`trust_${i}_beneficiaryName`]}/>
                    </Field>
                    <Field label="Is the trust revocable or irrevocable?" hint="Revocable = the creator can change or undo it. Irrevocable = once created, it generally cannot be changed." error={errors[`trust_${i}_trustType`]}>
                      <RadioGroup name={`trust_${i}_trustType`} current={t.trustType}
                        onChange={v=>u("trustEntries", data.trustEntries.map((x,idx)=>idx===i?{...x,trustType:v}:x))}
                        error={errors[`trust_${i}_trustType`]}
                        options={[
                          {value:"revocable",label:"Revocable"},
                          {value:"irrevocable",label:"Irrevocable"},
                          {value:"unsure",label:"I'm not sure"},
                        ]}/>
                    </Field>
                  </div>
                ))}
                <button type="button"
                  onClick={()=>u("trustEntries", [...(data.trustEntries || []), { id: Date.now(), trustName:"", propertyTransferred:"", propertyValue:"", trusteeName:"", beneficiaryName:"", trustType:"" }])}
                  className="w-full border border-dashed border-amber-400/40 hover:border-amber-400 text-amber-400 text-xs font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2">
                  <span className="text-base">+</span> Add Another Trust
                </button>
                <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-200"><strong className="text-red-300">⚑ Flagged for attorney review.</strong> Trust transfers within <strong className="text-white">10 years</strong> can be reviewed under § 548 (fraudulent-transfer), and trust assets may still be part of the bankruptcy estate under § 541 depending on the trust type. Your attorney will analyze.</p>
                </div>
              </div>
            )}
            <Field label="Any lawsuits filed against you or pending?" hint="Example: a creditor suing you for unpaid debt, a personal injury case, divorce or custody proceedings, an HOA lien suit." error={e("pendingLawsuits")}>
              <RadioGroup name="lawsuit" current={data.pendingLawsuits} onChange={v=>u("pendingLawsuits",v)} error={e("pendingLawsuits")} options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
            </Field>
            {data.pendingLawsuits==="yes" && (
              <div className="mt-2 space-y-2">
                {(data.lawsuitEntries || []).map((ls, i) => (
                  <div key={ls.id} className="bg-slate-900/60 border border-slate-600 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Lawsuit #{i+1}</p>
                      {(data.lawsuitEntries || []).length > 1 && (
                        <button type="button"
                          onClick={()=>u("lawsuitEntries", data.lawsuitEntries.filter(x => x.id !== ls.id))}
                          className="text-xs text-red-400 hover:text-red-300 underline">Remove</button>
                      )}
                    </div>
                    <Field label="Who is suing you?" hint="Example: Capital One, the landlord, a former business partner." error={errors[`lawsuit_${i}_plaintiff`]}>
                      <Input value={ls.plaintiff || ""}
                        onChange={v=>u("lawsuitEntries", data.lawsuitEntries.map((x,idx)=>idx===i?{...x,plaintiff:v}:x))}
                        placeholder="Name of plaintiff / creditor"
                        hasError={!!errors[`lawsuit_${i}_plaintiff`]}/>
                    </Field>
                    <Field label="What is the lawsuit about?" error={errors[`lawsuit_${i}_suitType`]}>
                      <Select value={ls.suitType}
                        onChange={v=>u("lawsuitEntries", data.lawsuitEntries.map((x,idx)=>idx===i?{...x,suitType:v}:x))}
                        hasError={!!errors[`lawsuit_${i}_suitType`]}
                        options={[
                          {value:"collection",label:"Collection — a creditor is suing for unpaid debt"},
                          {value:"broken_lease",label:"Broken lease — a landlord is suing for back rent or damages"},
                          {value:"other",label:"Other (add details below)"},
                        ]}
                        placeholder="Pick a type..."/>
                    </Field>
                    {ls.suitType === "other" && (
                      <Field label="Add details about the type of lawsuit" error={errors[`lawsuit_${i}_suitTypeOther`]}>
                        <Input value={ls.suitTypeOther || ""}
                          onChange={v=>u("lawsuitEntries", data.lawsuitEntries.map((x,idx)=>idx===i?{...x,suitTypeOther:v}:x))}
                          placeholder="e.g. car accident lawsuit, divorce proceeding, HOA lien"
                          hasError={!!errors[`lawsuit_${i}_suitTypeOther`]}/>
                      </Field>
                    )}
                    <Field label="Value of the claim against you" error={errors[`lawsuit_${i}_claimValue`]}>
                      {ls.claimValueUnknown ? (
                        <div className="flex items-center justify-between bg-slate-800/40 border border-slate-600 rounded-xl px-4 py-2.5">
                          <span className="text-slate-300 text-sm">Value unknown — attorney will estimate</span>
                          <button type="button"
                            onClick={()=>u("lawsuitEntries", data.lawsuitEntries.map((x,idx)=>idx===i?{...x,claimValueUnknown:false}:x))}
                            className="text-xs text-amber-400 hover:text-amber-300 underline">Enter amount instead</button>
                        </div>
                      ) : (
                        <div className="flex gap-2 items-start">
                          <div className="flex-1">
                            <Input type="number" value={ls.claimValue || ""}
                              onChange={v=>u("lawsuitEntries", data.lawsuitEntries.map((x,idx)=>idx===i?{...x,claimValue:v}:x))}
                              placeholder="Enter dollar amount"
                              hasError={!!errors[`lawsuit_${i}_claimValue`]}/>
                          </div>
                          <button type="button"
                            onClick={()=>u("lawsuitEntries", data.lawsuitEntries.map((x,idx)=>idx===i?{...x,claimValue:"",claimValueUnknown:true}:x))}
                            className="flex-shrink-0 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-slate-500 text-slate-400 hover:text-slate-200 px-3 py-2.5 rounded-xl transition-all whitespace-nowrap">
                            Unknown
                          </button>
                        </div>
                      )}
                    </Field>
                    <Field label="Details — what's happening with the lawsuit?" hint="Example: court case number, current stage (filed, served, in discovery, settled), upcoming hearing date." error={errors[`lawsuit_${i}_details`]}>
                      <Input value={ls.details || ""}
                        onChange={v=>u("lawsuitEntries", data.lawsuitEntries.map((x,idx)=>idx===i?{...x,details:v}:x))}
                        placeholder="Court, case number, status, dates"
                        hasError={!!errors[`lawsuit_${i}_details`]}/>
                    </Field>
                  </div>
                ))}
                <button type="button"
                  onClick={()=>u("lawsuitEntries", [...(data.lawsuitEntries || []), { id: Date.now(), plaintiff:"", suitType:"", suitTypeOther:"", claimValue:"", claimValueUnknown:false, details:"" }])}
                  className="w-full border border-dashed border-amber-400/40 hover:border-amber-400 text-amber-400 text-xs font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2">
                  <span className="text-base">+</span> Add Another Lawsuit
                </button>
                <div className="mt-1 p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-200"><strong className="text-red-300">⚑ Flagged for attorney review.</strong> Pending lawsuits against you affect <strong className="text-white">automatic stay</strong> timing, potential <strong className="text-white">non-dischargeability</strong> (e.g., fraud, intentional torts), and how the claim is treated on Schedule E/F.</p>
                </div>
              </div>
            )}

            {/* Garnishment / bank levy — sits with the lawsuits question
                because garnishments and levies are usually the enforcement
                step that follows a judgment. */}
            <Field label="Currently subject to wage garnishment or bank levy?" hint="Example: your paycheck has money taken out before you receive it for a debt, or your bank account was frozen by a creditor." error={e("garnishment")}>
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
                <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/25 mt-1">
                  <p className="text-[11px] text-blue-200"><strong className="text-blue-300">Good news:</strong> Filing bankruptcy <strong className="text-white">stops the garnishment right away</strong>.</p>
                  {parseFloat(data.garnishmentMonthlyAmount)>0 && (
                    <p className="text-[11px] text-blue-200 mt-1">Your paycheck will go up by about <strong className="text-green-400">${parseFloat(data.garnishmentMonthlyAmount||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}/month</strong>.</p>
                  )}
                </div>
              </>
            )}

            <Field label="Owned or operated a business in the last 4 years?" hint="Example: an LLC you started, a sole-proprietorship side gig, a partnership you closed last year." error={e("ownedBusiness")}>
              <RadioGroup name="biz" current={data.ownedBusiness} onChange={v=>u("ownedBusiness",v)} error={e("ownedBusiness")} options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
            </Field>
            {data.ownedBusiness === "yes" && (
              <div className="mt-2 space-y-2">
                {(data.businessEntries || []).map((biz, i) => (
                  <div key={biz.id} className="bg-slate-900/60 border border-slate-600 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Business #{i+1}</p>
                      {(data.businessEntries || []).length > 1 && (
                        <button type="button"
                          onClick={()=>u("businessEntries", data.businessEntries.filter(x => x.id !== biz.id))}
                          className="text-xs text-red-400 hover:text-red-300 underline">Remove</button>
                      )}
                    </div>
                    <Field label="Name of the business" error={errors[`biz_${i}_businessName`]}>
                      <Input value={biz.businessName || ""}
                        onChange={v=>u("businessEntries", data.businessEntries.map((x,idx)=>idx===i?{...x,businessName:v}:x))}
                        placeholder="e.g. Smith Consulting LLC"
                        hasError={!!errors[`biz_${i}_businessName`]}/>
                    </Field>
                    <Field label="What type of business entity is it?" error={errors[`biz_${i}_entityType`]}>
                      <Select value={biz.entityType}
                        onChange={v=>u("businessEntries", data.businessEntries.map((x,idx)=>idx===i?{...x,entityType:v}:x))}
                        hasError={!!errors[`biz_${i}_entityType`]}
                        options={[
                          {value:"sole_prop",label:"Sole Proprietorship"},
                          {value:"llc",label:"LLC (Limited Liability Company)"},
                          {value:"s_corp",label:"S-Corp"},
                          {value:"c_corp",label:"C-Corp"},
                          {value:"partnership",label:"Partnership"},
                          {value:"other",label:"Other"},
                        ]}
                        placeholder="Pick a type..."/>
                    </Field>
                    <Field label="What state is the business registered in?" hint="Example: Arizona, Delaware, Wyoming. Use 'N/A' if it's a sole proprietorship with no state filing." error={errors[`biz_${i}_stateOfIncorporation`]}>
                      <Select value={biz.stateOfIncorporation}
                        onChange={v=>u("businessEntries", data.businessEntries.map((x,idx)=>idx===i?{...x,stateOfIncorporation:v}:x))}
                        hasError={!!errors[`biz_${i}_stateOfIncorporation`]}
                        options={US_STATES}
                        placeholder="Pick a state..."/>
                    </Field>
                  </div>
                ))}
                <button type="button"
                  onClick={()=>u("businessEntries", [...(data.businessEntries || []), { id: Date.now(), businessName:"", entityType:"", stateOfIncorporation:"" }])}
                  className="w-full border border-dashed border-amber-400/40 hover:border-amber-400 text-amber-400 text-xs font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2">
                  <span className="text-base">+</span> Add Another Business
                </button>
              </div>
            )}
            {/* Tax refund question removed — already disclosed on Schedule A/B.
                DSO question removed — already disclosed on Schedule J expenses
                + Schedule E priority debts. */}

            {/* Tax filing status — bankruptcy requires the most recent returns
                be filed (§ 1308 / § 521(e)(2)(A)). Any unfiled return is a
                hard gate; "not required" exemption covers SS-only / no-income
                clients. Always flagged for attorney follow-up. */}
            <Field label="Have you filed all of your tax returns?" hint="Federal AND state income tax returns. Example: you filed your 2024, 2023, 2022 returns on time." error={e("hasFiledAllTaxReturns")}>
              <RadioGroup name="hasFiledAllTaxReturns" current={data.hasFiledAllTaxReturns}
                onChange={v=>{
                  u("hasFiledAllTaxReturns", v);
                  if (v === "yes" || v === "not_required") { u("unfiledTaxYears",""); }
                  if (v !== "not_required") { u("notRequiredToFile",""); u("notRequiredReason",""); u("notRequiredOtherDetails",""); }
                }}
                error={e("hasFiledAllTaxReturns")}
                options={[
                  {value:"yes",label:"Yes — all my tax returns are filed"},
                  {value:"no",label:"No — I have unfiled tax returns"},
                  {value:"not_required",label:"I am not required to file tax returns"},
                ]}/>
            </Field>
            {data.hasFiledAllTaxReturns === "no" && (
              <>
                <Field label="Which years are unfiled?" hint="List every tax year you have not yet filed. Example: '2023, 2022 (federal); 2024 (state)'." error={e("unfiledTaxYears")}>
                  <Input value={data.unfiledTaxYears}
                    onChange={v=>u("unfiledTaxYears", v)}
                    placeholder="e.g. 2024, 2023, 2022"
                    hasError={!!e("unfiledTaxYears")}/>
                </Field>
                <div className="mt-1 mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-200 leading-relaxed">
                    <strong className="text-red-300">⚑ Attorney action required.</strong> Bankruptcy generally requires that the <strong className="text-white">most recent tax returns</strong> (typically the last 4 years for the IRS) be <strong className="text-white">filed before filing</strong> your case. Under <strong className="text-amber-400">§ 1308 (Ch.13)</strong> the trustee can move to dismiss if pre-petition returns aren't filed; under <strong className="text-amber-400">§ 521(e)(2)(A)</strong> the most recent return must be provided in Ch.7.
                  </p>
                  <p className="text-sm text-red-200 mt-2 leading-relaxed">
                    Your attorney will work with you to get these filed before your case can move forward.
                  </p>
                </div>
                <Field label="I understand I must file these tax returns and be current before my bankruptcy case can be filed.">
                  <button type="button"
                    onClick={()=>u("confirmedMustFileBeforeFiling", !data.confirmedMustFileBeforeFiling)}
                    className={`w-full flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all ${data.confirmedMustFileBeforeFiling ? "bg-emerald-500/10 border-emerald-500 text-emerald-300" : "bg-slate-800 border-slate-600 text-slate-300 hover:border-amber-400/60"}`}>
                    <span className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center mt-0.5 ${data.confirmedMustFileBeforeFiling ? "bg-emerald-500 border-emerald-500" : "border-slate-500"}`}>
                      {data.confirmedMustFileBeforeFiling && <span className="text-slate-900 text-xs font-black">✓</span>}
                    </span>
                    <span className="text-sm font-semibold leading-snug">I acknowledge I must file all required tax returns and be current with my tax filings before my bankruptcy case can be filed.</span>
                  </button>
                </Field>
              </>
            )}
            {data.hasFiledAllTaxReturns === "not_required" && (
              <>
                <Field label="Why are you not required to file?" error={e("notRequiredReason")}>
                  <RadioGroup name="notRequiredReason" current={data.notRequiredReason}
                    onChange={v=>{
                      u("notRequiredReason", v);
                      if (v !== "other") u("notRequiredOtherDetails","");
                    }}
                    error={e("notRequiredReason")}
                    options={[
                      {value:"ss_only",label:"My only income is Social Security"},
                      {value:"not_employed",label:"I am not employed and have no other income"},
                      {value:"below_threshold",label:"My income is below the IRS filing threshold"},
                      {value:"other",label:"Other — please explain"},
                    ]}/>
                </Field>
                {data.notRequiredReason === "other" && (
                  <Field label="Please explain why you're not required to file" error={e("notRequiredOtherDetails")}>
                    <Input value={data.notRequiredOtherDetails}
                      onChange={v=>u("notRequiredOtherDetails", v)}
                      placeholder="Describe your situation"
                      hasError={!!e("notRequiredOtherDetails")}/>
                  </Field>
                )}
                <div className="mt-1 mb-3 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <p className="text-sm text-amber-200"><strong className="text-amber-400">⚑ Flagged for attorney review.</strong> Your attorney will confirm you actually have no filing obligation and document the basis in the case file.</p>
                </div>
              </>
            )}

            {/* Property stored / held by another person — exact wording from
                the locked client portal questionnaire (Part 4). */}
            <Field label="Do you have any property you own that is currently being held, stored, or maintained by another person?" hint="Example: a storage unit, a car at a friend's house, items in a relative's garage, jewelry in a safe deposit box, or property at a repair shop." error={e("propertyStoredElsewhere")}>
              <RadioGroup name="propertyStoredElsewhere" current={data.propertyStoredElsewhere}
                onChange={v=>u("propertyStoredElsewhere", v)} error={e("propertyStoredElsewhere")}
                options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
            </Field>
            {data.propertyStoredElsewhere === "yes" && (
              <div className="mt-2 space-y-2">
                {(data.storedPropertyEntries || []).map((sp, i) => (
                  <div key={sp.id} className="bg-slate-900/60 border border-slate-600 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Stored Item #{i+1}</p>
                      {(data.storedPropertyEntries || []).length > 1 && (
                        <button type="button"
                          onClick={()=>u("storedPropertyEntries", data.storedPropertyEntries.filter(x => x.id !== sp.id))}
                          className="text-xs text-red-400 hover:text-red-300 underline">Remove</button>
                      )}
                    </div>
                    <Field label="Where is it being held or stored?">
                      <Select value={sp.locationType}
                        onChange={v=>u("storedPropertyEntries", data.storedPropertyEntries.map((x,idx)=>idx===i?{...x,locationType:v}:x))}
                        options={["Storage Unit","At Another Person's Home / Address","Safe Deposit Box","Repair Shop / Mechanic","Other"]}
                        placeholder="Pick a location..."/>
                    </Field>
                    <Field label="Specific location (address, facility name, or person's name)">
                      <Input value={sp.locationDetails}
                        onChange={v=>u("storedPropertyEntries", data.storedPropertyEntries.map((x,idx)=>idx===i?{...x,locationDetails:v}:x))}
                        placeholder="e.g. Public Storage on Camelback, or Mom's house at 123 Main St"/>
                    </Field>
                    <Field label="What items are being held there?">
                      <Input value={sp.items}
                        onChange={v=>u("storedPropertyEntries", data.storedPropertyEntries.map((x,idx)=>idx===i?{...x,items:v}:x))}
                        placeholder="e.g. Furniture, boxes of clothes, golf clubs"/>
                    </Field>
                    <Field label="Estimated total value">
                      <Input type="number" value={sp.value}
                        onChange={v=>u("storedPropertyEntries", data.storedPropertyEntries.map((x,idx)=>idx===i?{...x,value:v}:x))}
                        placeholder="Enter amount"/>
                    </Field>
                  </div>
                ))}
                <button type="button"
                  onClick={()=>u("storedPropertyEntries", [...(data.storedPropertyEntries || []), { id: Date.now(), locationType:"", locationDetails:"", items:"", value:"" }])}
                  className="w-full border border-dashed border-amber-400/40 hover:border-amber-400 text-amber-400 text-xs font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2">
                  <span className="text-base">+</span> Add Another Location
                </button>
              </div>
            )}

            {/* Reverse — does the client HOLD property belonging to someone
                else? SOFA Part 9, Question 23. */}
            <Field label="Do you hold property that belongs to someone else?" hint="Example: a friend's couch in your garage, a relative's car parked at your house, items left behind by a former roommate." error={e("holdsPropertyForOther")}>
              <RadioGroup name="holdsPropertyForOther" current={data.holdsPropertyForOther}
                onChange={v=>u("holdsPropertyForOther", v)} error={e("holdsPropertyForOther")}
                options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
            </Field>
            {data.holdsPropertyForOther === "yes" && (
              <div className="mt-2 space-y-2">
                {(data.propertyHeldForOtherEntries || []).map((ph, i) => (
                  <div key={ph.id} className="bg-slate-900/60 border border-slate-600 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Held Item #{i+1}</p>
                      {(data.propertyHeldForOtherEntries || []).length > 1 && (
                        <button type="button"
                          onClick={()=>u("propertyHeldForOtherEntries", data.propertyHeldForOtherEntries.filter(x => x.id !== ph.id))}
                          className="text-xs text-red-400 hover:text-red-300 underline">Remove</button>
                      )}
                    </div>
                    <Field label="Who do you hold this property for?" error={errors[`heldFor_${i}_ownerName`]}>
                      <Input value={ph.ownerName || ""}
                        onChange={v=>u("propertyHeldForOtherEntries", data.propertyHeldForOtherEntries.map((x,idx)=>idx===i?{...x,ownerName:v}:x))}
                        placeholder="Full name of the owner"
                        hasError={!!errors[`heldFor_${i}_ownerName`]}/>
                    </Field>
                    <Field label="Describe the property" error={errors[`heldFor_${i}_description`]}>
                      <Input value={ph.description || ""}
                        onChange={v=>u("propertyHeldForOtherEntries", data.propertyHeldForOtherEntries.map((x,idx)=>idx===i?{...x,description:v}:x))}
                        placeholder="e.g. 2014 Honda Civic, set of golf clubs, boxes of books"
                        hasError={!!errors[`heldFor_${i}_description`]}/>
                    </Field>
                  </div>
                ))}
                <button type="button"
                  onClick={()=>u("propertyHeldForOtherEntries", [...(data.propertyHeldForOtherEntries || []), { id: Date.now(), ownerName:"", description:"" }])}
                  className="w-full border border-dashed border-amber-400/40 hover:border-amber-400 text-amber-400 text-xs font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2">
                  <span className="text-base">+</span> Add Another Item
                </button>
              </div>
            )}

            <Field label="Luxury purchases over $800 or cash advances over $1,125 in the last 90 days?" hint="Example: a $1,200 vacation booked on a credit card, a $900 designer handbag, or a $1,500 cash advance against a credit line." error={e("recentLuxury")}>
              <RadioGroup name="luxury" current={data.recentLuxury} onChange={v=>u("recentLuxury",v)} error={e("recentLuxury")} options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
              {data.recentLuxury==="yes" && <div className="mt-2"><Input value={data.luxuryDetails} onChange={v=>u("luxuryDetails",v)} placeholder="Describe the purchases" hasError={!!e("luxuryDetails")}/>{e("luxuryDetails") && <p className="text-xs text-red-400 mt-1">⚠ {e("luxuryDetails")}</p>}</div>}
            </Field>
            {/* Garnishment / bank levy question moved up — placed directly
                below the lawsuits question since garnishments typically
                follow a judgment from a lawsuit. */}
            {/* Losses to fire / theft / gambling — SOFA Part 8 disclosure. */}
            <Field label="Have you lost any money to fire, theft, or gambling in the last year?" hint="Things like a house fire, a burglary, or money lost at a casino or sports betting." error={e("hasLosses")}>
              <RadioGroup name="hasLosses" current={data.hasLosses} onChange={v=>u("hasLosses",v)} error={e("hasLosses")}
                options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
            </Field>
            {data.hasLosses === "yes" && (
              <div className="mt-2 space-y-2">
                {(data.lossEntries || []).map((ls, i) => (
                  <div key={ls.id} className="bg-slate-900/60 border border-slate-600 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Loss #{i+1}</p>
                      {(data.lossEntries || []).length > 1 && (
                        <button type="button"
                          onClick={()=>u("lossEntries", data.lossEntries.filter(x => x.id !== ls.id))}
                          className="text-xs text-red-400 hover:text-red-300 underline">Remove</button>
                      )}
                    </div>
                    <Field label="What kind of loss was it?" error={errors[`loss_${i}_type`]}>
                      <RadioGroup name={`loss_${i}_type`} current={ls.type}
                        onChange={v=>u("lossEntries", data.lossEntries.map((x,idx)=>idx===i?{...x,type:v}:x))}
                        error={errors[`loss_${i}_type`]}
                        options={[
                          {value:"fire",label:"🔥 Fire (house fire, business fire, etc.)"},
                          {value:"theft",label:"🚨 Theft (burglary, stolen items, scam)"},
                          {value:"gambling",label:"🎲 Gambling (casino, sports betting, lottery, etc.)"},
                        ]}/>
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="When did it happen?" error={errors[`loss_${i}_lossDate`]}>
                        <Input type="date" value={ls.lossDate}
                          onChange={v=>u("lossEntries", data.lossEntries.map((x,idx)=>idx===i?{...x,lossDate:v}:x))}
                          hasError={!!errors[`loss_${i}_lossDate`]}/>
                      </Field>
                      <Field label="How much did you lose?" error={errors[`loss_${i}_amount`]}>
                        <Input type="number" value={ls.amount}
                          onChange={v=>u("lossEntries", data.lossEntries.map((x,idx)=>idx===i?{...x,amount:v}:x))}
                          placeholder="e.g. 5000" hasError={!!errors[`loss_${i}_amount`]}/>
                      </Field>
                    </div>
                    <Field label="Briefly describe what happened (optional)">
                      <Input value={ls.description}
                        onChange={v=>u("lossEntries", data.lossEntries.map((x,idx)=>idx===i?{...x,description:v}:x))}
                        placeholder="e.g. Kitchen fire, car broken into, blackjack losses"/>
                    </Field>
                  </div>
                ))}
                <button type="button"
                  onClick={()=>u("lossEntries", [...(data.lossEntries || []), { id: Date.now(), type:"", lossDate:"", amount:"", description:"" }])}
                  className="w-full border border-dashed border-amber-400/40 hover:border-amber-400 text-amber-400 text-xs font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2">
                  <span className="text-base">+</span> Add Another Loss
                </button>
              </div>
            )}

            {/* Foreclosure question moved to Real Property section so all
                property-related questions live together. State keys preserved. */}
          </SectionCard>
          <ErrorBanner errors={errors}/>
        </div>
      );

      case 8: return (
        <div>
          {!FIRM.enablePersonalInjuryScreening && (
            <div className="mb-4 p-4 bg-slate-800/60 border border-slate-600 rounded-xl">
              <p className="text-base text-white font-bold">
                The <strong className="text-amber-400">Personal Injury Screening</strong> step is turned off for this firm. Click <strong className="text-amber-400">Next →</strong> to continue to Review &amp; Submit.
              </p>
            </div>
          )}
          {FIRM.enablePersonalInjuryScreening && <>
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
                          <p className="text-sm font-semibold text-amber-400 mb-1">Submit Your Personal Injury Information</p>
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
          </>}

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
                  <p className="text-amber-400 font-semibold">IMPORTANT — PLEASE READ:</p>
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
                  <span className="text-sm font-semibold leading-snug">{CERT_TEXT}</span>
                </button>
                {e("confirmedAccurate") && <p className="text-xs text-red-400 mt-2">⚠ {e("confirmedAccurate")}</p>}

                {/* SMS / email consent — TCPA-aligned; required for submission.
                    Text comes from FIRM.smsConsentText (with {firmName} sub),
                    falling back to DEFAULT_SMS_TEXT. Editable in Department
                    Settings. */}
                <button onClick={()=>u("smsEmailConsent",!data.smsEmailConsent)}
                  className={`mt-3 w-full flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all ${data.smsEmailConsent?"bg-amber-400/10 border-amber-400 text-amber-200":"bg-slate-800 border-slate-600 text-slate-300 hover:border-amber-400/60"}`}>
                  <span className={`w-6 h-6 rounded border-2 flex-shrink-0 flex items-center justify-center mt-0.5 ${data.smsEmailConsent?"bg-amber-400 border-amber-400":"border-slate-500"}`}>
                    {data.smsEmailConsent && <span className="text-slate-900 text-xs font-black">✓</span>}
                  </span>
                  <span className="text-xs font-medium leading-snug">
                    {SMS_TEXT}
                  </span>
                </button>
                {e("smsEmailConsent") && <p className="text-xs text-red-400 mt-2">⚠ {e("smsEmailConsent")}</p>}
              </SectionCard>
              {submitError && (
                <div className="mb-3 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
                  <span className="font-bold text-red-300">Submission problem:</span> {submitError}
                </div>
              )}
              <div className="mb-4">
                <button onClick={submitIntake} disabled={submitting || !data.confirmedAccurate || !data.readInfoSheet || !data.smsEmailConsent}
                  className={`w-full font-bold py-4 px-4 rounded-xl transition-all text-sm uppercase tracking-wider flex items-center justify-center gap-2 ${submitting?"bg-slate-600 text-slate-400 cursor-not-allowed":(!data.confirmedAccurate || !data.readInfoSheet || !data.smsEmailConsent)?"bg-slate-700 text-slate-500 cursor-not-allowed":"bg-amber-400 hover:bg-amber-300 text-slate-900"}`}>
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
    // Case 0 (Filing Type) intentionally null — the styled inline block at the
    // top of the case-0 render is the single source of truth.
    null,
    // Case 1 (Household) intentionally null — the styled inline block at the
    // top of the case-1 render is the single source of truth so we don't show
    // the same explanation twice.
    null,
    // Case 2 (Income) intentionally null — the styled inline block at the
    // top of the case-2 render is the single source of truth.
    null,
    // Case 3 (Real Estate) intentionally null — the styled inline block at the
    // top of the case-3 render (with yellow terms + centered title) is the
    // single source of truth so the same copy doesn't show twice.
    null,
    // Case 4 (Personal Property) intentionally null — the styled inline block
    // at the top of the case-4 render is the single source of truth.
    null,
    // Case 5 (Expenses) intentionally null — the styled inline block at the
    // top of the case-5 render is the single source of truth.
    null,
    {icon:"💳",title:"Creditor Information",body:"The Bankruptcy Code requires disclosure of ALL creditors you owe money to. You must provide every secured, priority, and general unsecured (non-priority) creditor — no debt may be omitted, even if you intend to continue paying it."},
    {icon:"📋",title:"Recent financial history",body:"Bankruptcy law requires full disclosure of your recent financial activity, including asset transfers, large payments, and other transactions from the prior 2–4 years. This information is reviewed by the bankruptcy trustee to ensure there are no preferential transfers or other issues that could affect your case."},
    // Case 8 (Personal Injury Screening) intentionally null — the section
    // header and intro live inside the case-8 SectionCard. Per firm spec,
    // the PI step also defaults to OFF (firmConfig.enablePersonalInjuryScreening)
    // so most firms skip the step entirely.
    null,
    {icon:"✅",title:"Review and submit your information",body:"Please carefully review the summary below before submitting. Your attorney will use this information to prepare your official bankruptcy schedules. Accuracy is essential — errors or omissions may need to be corrected with the court."},
  ];

  return (
    <div className="min-h-screen bg-slate-950 font-sans" ref={topRef}>
      {!started ? (
        <div className="min-h-screen flex flex-col">
          <div className="bg-slate-900 border-b border-slate-800 px-4 py-4">
            <div className="max-w-lg mx-auto flex items-center gap-2">
              {FIRM.logoUrl ? (
                <img src={FIRM.logoUrl} alt={FIRM.name} className="h-8 w-auto"/>
              ) : (
                <>
                  <span className="font-serif text-lg font-bold text-white">{FIRM.name}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex-1 max-w-xl mx-auto w-full px-4 py-10">
            {/* Firm logo / brand mark. Default amber-circled ⚖️ glyph until
                the firm uploads a custom logo via department settings. */}
            <div className="text-center mb-8">
              {FIRM.logoUrl ? (
                <img src={FIRM.logoUrl} alt={FIRM.name} className="mx-auto mb-5 max-h-24 w-auto"/>
              ) : (
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-400/10 border-2 border-amber-400/30 mb-5">
                  <span className="text-4xl">⚖️</span>
                </div>
              )}
              <h1 className="font-serif text-3xl font-bold text-white mb-3 leading-snug">
                <span className="text-amber-400">{FIRM.name}</span> invites you to fill out our new client questionnaire
              </h1>
              {FIRM.welcomeMessage && (
                <p className="text-base text-white font-semibold leading-relaxed mt-3">{FIRM.welcomeMessage}</p>
              )}
            </div>

            {/* Consolidated disclosure — replaces the prior About / Important
                blocks per firm spec. Concise, hits the four required points:
                (1) no attorney-client relationship from filling this out,
                (2) info reviewed with an attorney for bankruptcy eligibility,
                (3) accuracy is important; use the chat if unsure,
                (4) not legal advice; response comes after attorney review.
                Body text uses one consistent size (text-base ≈ 16px) for
                readability. */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 mb-6">
              <p className="text-lg font-bold text-amber-400 mb-4 text-center">Please Read Before You Begin</p>
              <ol className="space-y-4 text-base text-white font-bold leading-relaxed list-none">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-400 font-bold flex items-center justify-center text-sm">1</span>
                  <span>Filling out this questionnaire <strong className="text-amber-400">does not create an attorney-client relationship</strong>.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-400 font-bold flex items-center justify-center text-sm">2</span>
                  <span>Your information will be reviewed with an attorney to evaluate your <strong className="text-amber-400">bankruptcy eligibility</strong>.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-400 font-bold flex items-center justify-center text-sm">3</span>
                  <span>It is important that all information is <strong className="text-amber-400">true and accurate</strong>. If you're not sure about a question, use the <strong className="text-amber-400">Ask a Question</strong> chat in the corner to get help.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-400 font-bold flex items-center justify-center text-sm">4</span>
                  <span>Nothing on this form is <strong className="text-amber-400">legal advice</strong>. Once you finish, your information will be submitted and a response will be provided after attorney review.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-400 font-bold flex items-center justify-center text-sm">5</span>
                  <span>Everything you share is <strong className="text-amber-400">strictly confidential</strong> and will only be reviewed by our office.</span>
                </li>
              </ol>
            </div>

            <div className="mb-8">
              <button onClick={()=>{ setStarted(true); topRef.current?.scrollIntoView({behavior:"smooth"}); }}
                className="w-full bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold py-4 rounded-xl text-base uppercase tracking-wider transition-all flex items-center justify-center gap-3 shadow-lg shadow-amber-400/20">
                <span>⚖️</span> Begin Questionnaire →
              </button>
              <p className="text-base text-slate-400 text-center mt-3">Takes about 15 minutes — you can go back and edit your answers at any time.</p>
            </div>

            {/* Firm contact info — phone is always shown; email line is
                optional and only renders if the firm configured one in
                department settings. */}
            <div className="text-center space-y-1">
              <p className="text-base text-slate-400">
                Questions? Call us at{" "}
                <a href={FIRM.phoneHref} className="text-amber-400 hover:text-amber-400 transition-colors font-semibold">{FIRM.phone}</a>
              </p>
              {FIRM.contactEmail && (
                <p className="text-base text-slate-400">
                  or email{" "}
                  <a href={`mailto:${FIRM.contactEmail}`} className="text-amber-400 hover:text-amber-400 transition-colors font-semibold">{FIRM.contactEmail}</a>
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div className="bg-slate-900 border-b border-slate-800 py-4 sticky top-0 z-10">
            <PageContainer className="flex items-center justify-between">
              <div>
                <span className="font-serif text-lg font-bold text-white">bankruptcy</span>
                <span className="font-serif text-lg font-bold text-amber-400">.AI</span>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-400">Step {step+1} of {SECTIONS.length}</p>
                <p className="text-sm text-amber-400 font-medium">{SECTIONS[step]}</p>
              </div>
            </PageContainer>
            <PageContainer className="mt-3">
              <div className="w-full bg-slate-800 rounded-full h-2">
                <div className="bg-amber-400 h-2 rounded-full transition-all duration-500" style={{width:`${(step/(SECTIONS.length-1))*100}%`}}/>
              </div>
              <div className="flex justify-between mt-2 gap-1 overflow-x-auto">
                {SECTIONS.map((s,i)=>(
                  <button key={i} onClick={()=>i<step&&setStep(i)}
                    className={`text-sm flex-shrink-0 transition-colors ${i===step?"text-amber-400 font-semibold":i<step?"text-green-400 cursor-pointer":"text-slate-600"}`}>
                    {i<step?"✓":i+1}
                  </button>
                ))}
              </div>
            </PageContainer>
          </div>
          {isStaffSession && (
            <div className={`py-3 border-b ${isTakeover ? 'bg-amber-900/80 border-amber-500/30' : 'bg-blue-900/70 border-blue-500/30'}`}>
              <PageContainer>
                <div className="flex items-start gap-3">
                  <span className={`flex-shrink-0 mt-0.5 font-bold text-base ${isTakeover ? 'text-amber-400' : 'text-blue-400'}`}>
                    {isTakeover ? '⚠' : 'ℹ'}
                  </span>
                  <div>
                    {isTakeover ? (
                      <>
                        <p className="text-xs font-bold text-amber-400 mb-0.5 uppercase tracking-wide">Legal Administrator — Staff-Assisted Session</p>
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
              </PageContainer>
            </div>
          )}
          <PageContainer width="narrow" className="py-6 pb-28">
            <div className="flex-1 min-w-0">
              <h2 className="font-serif text-2xl font-bold text-amber-400 mb-2 whitespace-nowrap">{SECTIONS[step]}</h2>
              {stepIntros[step] && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 mb-6 flex gap-3">
                  <span className="text-2xl flex-shrink-0 mt-0.5">{stepIntros[step].icon}</span>
                  <div>
                    <p className="text-base font-bold text-amber-400 mb-1.5">{stepIntros[step].title}</p>
                    <p className="text-sm font-bold text-white leading-relaxed">{stepIntros[step].body}</p>
                  </div>
                </div>
              )}
              {renderSection()}
            </div>
          </PageContainer>
          {/* Compact "Ask a Question" chat — always lives in the bottom-right
              corner. Starts collapsed so clients see the form prompts first;
              they tap to expand when they actually have a question. */}
          <div className="fixed bottom-20 right-4 z-40 w-72">
            <IntakeChatbot
              clientId={clientId}
              clientName={clientName}
              sessionId={sessionId}
              isAdmin={false}
            />
          </div>
          {(step < 9 || (step === 9 && !submitted)) && (
            <div className="fixed bottom-0 left-0 right-0 bg-slate-950 border-t border-slate-800 py-4">
              <PageContainer className="flex gap-3">
                {step > 0 && (
                  <button onClick={()=>{
                    setErrors({});
                    // Mirror handleContinue — skip back over step 8 when the
                    // firm has PI screening disabled.
                    setStep(s => {
                      const prev = s - 1;
                      if (prev === 8 && !FIRM.enablePersonalInjuryScreening) return 7;
                      return prev;
                    });
                    topRef.current?.scrollIntoView({behavior:"smooth"});
                  }}
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
              </PageContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
