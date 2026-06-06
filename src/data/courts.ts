export interface CourtDistrict {
  label: string;
  value: string;
}

export const COURTS_BY_STATE: Record<string, CourtDistrict[]> = {
  "Arizona": [
    { label: "U.S. Bankruptcy Court — District of Arizona (Phoenix)", value: "District of Arizona (Phoenix Division)" },
    { label: "U.S. Bankruptcy Court — District of Arizona (Tucson)", value: "District of Arizona (Tucson Division)" },
    { label: "U.S. Bankruptcy Court — District of Arizona (Yuma)", value: "District of Arizona (Yuma Division)" },
  ],
  "Washington": [
    { label: "U.S. Bankruptcy Court — Western District of Washington (Seattle)", value: "Western District of Washington (Seattle Division)" },
    { label: "U.S. Bankruptcy Court — Western District of Washington (Tacoma)", value: "Western District of Washington (Tacoma Division)" },
    { label: "U.S. Bankruptcy Court — Eastern District of Washington (Spokane)", value: "Eastern District of Washington (Spokane Division)" },
    { label: "U.S. Bankruptcy Court — Eastern District of Washington (Yakima)", value: "Eastern District of Washington (Yakima Division)" },
  ],
  "Alabama": [
    { label: "U.S. Bankruptcy Court — Northern District of Alabama", value: "Northern District of Alabama" },
    { label: "U.S. Bankruptcy Court — Middle District of Alabama", value: "Middle District of Alabama" },
    { label: "U.S. Bankruptcy Court — Southern District of Alabama", value: "Southern District of Alabama" },
  ],
  "Alaska": [
    { label: "U.S. Bankruptcy Court — District of Alaska", value: "District of Alaska" },
  ],
  "Arkansas": [
    { label: "U.S. Bankruptcy Court — Eastern District of Arkansas", value: "Eastern District of Arkansas" },
    { label: "U.S. Bankruptcy Court — Western District of Arkansas", value: "Western District of Arkansas" },
  ],
  "California": [
    { label: "U.S. Bankruptcy Court — Northern District of California", value: "Northern District of California" },
    { label: "U.S. Bankruptcy Court — Eastern District of California", value: "Eastern District of California" },
    { label: "U.S. Bankruptcy Court — Central District of California", value: "Central District of California" },
    { label: "U.S. Bankruptcy Court — Southern District of California", value: "Southern District of California" },
  ],
  "Colorado": [
    { label: "U.S. Bankruptcy Court — District of Colorado", value: "District of Colorado" },
  ],
  "Connecticut": [
    { label: "U.S. Bankruptcy Court — District of Connecticut", value: "District of Connecticut" },
  ],
  "Delaware": [
    { label: "U.S. Bankruptcy Court — District of Delaware", value: "District of Delaware" },
  ],
  "Florida": [
    { label: "U.S. Bankruptcy Court — Northern District of Florida", value: "Northern District of Florida" },
    { label: "U.S. Bankruptcy Court — Middle District of Florida", value: "Middle District of Florida" },
    { label: "U.S. Bankruptcy Court — Southern District of Florida", value: "Southern District of Florida" },
  ],
  "Georgia": [
    { label: "U.S. Bankruptcy Court — Northern District of Georgia", value: "Northern District of Georgia" },
    { label: "U.S. Bankruptcy Court — Middle District of Georgia", value: "Middle District of Georgia" },
    { label: "U.S. Bankruptcy Court — Southern District of Georgia", value: "Southern District of Georgia" },
  ],
  "Hawaii": [
    { label: "U.S. Bankruptcy Court — District of Hawaii", value: "District of Hawaii" },
  ],
  "Idaho": [
    { label: "U.S. Bankruptcy Court — District of Idaho", value: "District of Idaho" },
  ],
  "Illinois": [
    { label: "U.S. Bankruptcy Court — Northern District of Illinois", value: "Northern District of Illinois" },
    { label: "U.S. Bankruptcy Court — Central District of Illinois", value: "Central District of Illinois" },
    { label: "U.S. Bankruptcy Court — Southern District of Illinois", value: "Southern District of Illinois" },
  ],
  "Indiana": [
    { label: "U.S. Bankruptcy Court — Northern District of Indiana", value: "Northern District of Indiana" },
    { label: "U.S. Bankruptcy Court — Southern District of Indiana", value: "Southern District of Indiana" },
  ],
  "Iowa": [
    { label: "U.S. Bankruptcy Court — Northern District of Iowa", value: "Northern District of Iowa" },
    { label: "U.S. Bankruptcy Court — Southern District of Iowa", value: "Southern District of Iowa" },
  ],
  "Kansas": [
    { label: "U.S. Bankruptcy Court — District of Kansas", value: "District of Kansas" },
  ],
  "Kentucky": [
    { label: "U.S. Bankruptcy Court — Eastern District of Kentucky", value: "Eastern District of Kentucky" },
    { label: "U.S. Bankruptcy Court — Western District of Kentucky", value: "Western District of Kentucky" },
  ],
  "Louisiana": [
    { label: "U.S. Bankruptcy Court — Eastern District of Louisiana", value: "Eastern District of Louisiana" },
    { label: "U.S. Bankruptcy Court — Middle District of Louisiana", value: "Middle District of Louisiana" },
    { label: "U.S. Bankruptcy Court — Western District of Louisiana", value: "Western District of Louisiana" },
  ],
  "Maine": [
    { label: "U.S. Bankruptcy Court — District of Maine", value: "District of Maine" },
  ],
  "Maryland": [
    { label: "U.S. Bankruptcy Court — District of Maryland", value: "District of Maryland" },
  ],
  "Massachusetts": [
    { label: "U.S. Bankruptcy Court — District of Massachusetts", value: "District of Massachusetts" },
  ],
  "Michigan": [
    { label: "U.S. Bankruptcy Court — Eastern District of Michigan", value: "Eastern District of Michigan" },
    { label: "U.S. Bankruptcy Court — Western District of Michigan", value: "Western District of Michigan" },
  ],
  "Minnesota": [
    { label: "U.S. Bankruptcy Court — District of Minnesota", value: "District of Minnesota" },
  ],
  "Mississippi": [
    { label: "U.S. Bankruptcy Court — Northern District of Mississippi", value: "Northern District of Mississippi" },
    { label: "U.S. Bankruptcy Court — Southern District of Mississippi", value: "Southern District of Mississippi" },
  ],
  "Missouri": [
    { label: "U.S. Bankruptcy Court — Eastern District of Missouri", value: "Eastern District of Missouri" },
    { label: "U.S. Bankruptcy Court — Western District of Missouri", value: "Western District of Missouri" },
  ],
  "Montana": [
    { label: "U.S. Bankruptcy Court — District of Montana", value: "District of Montana" },
  ],
  "Nebraska": [
    { label: "U.S. Bankruptcy Court — District of Nebraska", value: "District of Nebraska" },
  ],
  "Nevada": [
    { label: "U.S. Bankruptcy Court — District of Nevada", value: "District of Nevada" },
  ],
  "New Hampshire": [
    { label: "U.S. Bankruptcy Court — District of New Hampshire", value: "District of New Hampshire" },
  ],
  "New Jersey": [
    { label: "U.S. Bankruptcy Court — District of New Jersey", value: "District of New Jersey" },
  ],
  "New Mexico": [
    { label: "U.S. Bankruptcy Court — District of New Mexico", value: "District of New Mexico" },
  ],
  "New York": [
    { label: "U.S. Bankruptcy Court — Northern District of New York", value: "Northern District of New York" },
    { label: "U.S. Bankruptcy Court — Eastern District of New York", value: "Eastern District of New York" },
    { label: "U.S. Bankruptcy Court — Southern District of New York", value: "Southern District of New York" },
    { label: "U.S. Bankruptcy Court — Western District of New York", value: "Western District of New York" },
  ],
  "North Carolina": [
    { label: "U.S. Bankruptcy Court — Eastern District of North Carolina", value: "Eastern District of North Carolina" },
    { label: "U.S. Bankruptcy Court — Middle District of North Carolina", value: "Middle District of North Carolina" },
    { label: "U.S. Bankruptcy Court — Western District of North Carolina", value: "Western District of North Carolina" },
  ],
  "North Dakota": [
    { label: "U.S. Bankruptcy Court — District of North Dakota", value: "District of North Dakota" },
  ],
  "Ohio": [
    { label: "U.S. Bankruptcy Court — Northern District of Ohio", value: "Northern District of Ohio" },
    { label: "U.S. Bankruptcy Court — Southern District of Ohio", value: "Southern District of Ohio" },
  ],
  "Oklahoma": [
    { label: "U.S. Bankruptcy Court — Northern District of Oklahoma", value: "Northern District of Oklahoma" },
    { label: "U.S. Bankruptcy Court — Eastern District of Oklahoma", value: "Eastern District of Oklahoma" },
    { label: "U.S. Bankruptcy Court — Western District of Oklahoma", value: "Western District of Oklahoma" },
  ],
  "Oregon": [
    { label: "U.S. Bankruptcy Court — District of Oregon", value: "District of Oregon" },
  ],
  "Pennsylvania": [
    { label: "U.S. Bankruptcy Court — Eastern District of Pennsylvania", value: "Eastern District of Pennsylvania" },
    { label: "U.S. Bankruptcy Court — Middle District of Pennsylvania", value: "Middle District of Pennsylvania" },
    { label: "U.S. Bankruptcy Court — Western District of Pennsylvania", value: "Western District of Pennsylvania" },
  ],
  "Rhode Island": [
    { label: "U.S. Bankruptcy Court — District of Rhode Island", value: "District of Rhode Island" },
  ],
  "South Carolina": [
    { label: "U.S. Bankruptcy Court — District of South Carolina", value: "District of South Carolina" },
  ],
  "South Dakota": [
    { label: "U.S. Bankruptcy Court — District of South Dakota", value: "District of South Dakota" },
  ],
  "Tennessee": [
    { label: "U.S. Bankruptcy Court — Eastern District of Tennessee", value: "Eastern District of Tennessee" },
    { label: "U.S. Bankruptcy Court — Middle District of Tennessee", value: "Middle District of Tennessee" },
    { label: "U.S. Bankruptcy Court — Western District of Tennessee", value: "Western District of Tennessee" },
  ],
  "Texas": [
    { label: "U.S. Bankruptcy Court — Northern District of Texas", value: "Northern District of Texas" },
    { label: "U.S. Bankruptcy Court — Eastern District of Texas", value: "Eastern District of Texas" },
    { label: "U.S. Bankruptcy Court — Southern District of Texas", value: "Southern District of Texas" },
    { label: "U.S. Bankruptcy Court — Western District of Texas", value: "Western District of Texas" },
  ],
  "Utah": [
    { label: "U.S. Bankruptcy Court — District of Utah", value: "District of Utah" },
  ],
  "Vermont": [
    { label: "U.S. Bankruptcy Court — District of Vermont", value: "District of Vermont" },
  ],
  "Virginia": [
    { label: "U.S. Bankruptcy Court — Eastern District of Virginia", value: "Eastern District of Virginia" },
    { label: "U.S. Bankruptcy Court — Western District of Virginia", value: "Western District of Virginia" },
  ],
  "West Virginia": [
    { label: "U.S. Bankruptcy Court — Northern District of West Virginia", value: "Northern District of West Virginia" },
    { label: "U.S. Bankruptcy Court — Southern District of West Virginia", value: "Southern District of West Virginia" },
  ],
  "Wisconsin": [
    { label: "U.S. Bankruptcy Court — Eastern District of Wisconsin", value: "Eastern District of Wisconsin" },
    { label: "U.S. Bankruptcy Court — Western District of Wisconsin", value: "Western District of Wisconsin" },
  ],
  "Wyoming": [
    { label: "U.S. Bankruptcy Court — District of Wyoming", value: "District of Wyoming" },
  ],
  "District of Columbia": [
    { label: "U.S. Bankruptcy Court — District of Columbia", value: "District of Columbia" },
  ],
};

export function getCourtsForState(state: string): CourtDistrict[] {
  return COURTS_BY_STATE[state] ?? [{ label: `U.S. Bankruptcy Court — District of ${state}`, value: `District of ${state}` }];
}
