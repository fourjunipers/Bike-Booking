# Thai lines to review: fleet rework (12 Nov 2026)

New or changed Thai texts in `apps/platform/messages/th.json` on the branch `platform/fleet-rework`. They are Claude's translations and need a native check. Correct them in `th.json` (the key is in the first column); this file can be deleted once they are approved.

Thai already used the general word for a vehicle (รถ, counted in คัน) wherever English said “bike”, so the bike-to-vehicle change needed no Thai edits beyond the lines below.

## Buttons and Fleet page

| Key | English | Thai |
| --- | --- | --- |
| `Fleet.addModel` | Make & model | ยี่ห้อและรุ่น |
| `Fleet.addUnit` | Add to inventory | เพิ่มเข้าคลังรถ |
| `Fleet.addUnitTo` | Add a {name} to inventory | เพิ่ม {name} เข้าคลังรถ |
| `Fleet.editModel` | Edit make & model | แก้ไขยี่ห้อและรุ่น |
| `Fleet.intro` | {units, plural, =0 {No vehicles yet} one {# vehicle} other {# vehicles}} in {models, plural, one {# make & model} other {# makes & models}}. | {units, plural, =0 {ยังไม่มีรถ} other {รถ # คัน}} ใน {models, plural, other {# ยี่ห้อและรุ่น}} |
| `Fleet.empty` | Nothing here yet. Start with “Make & model”, then add your vehicles to the inventory, or import them all from a CSV file. | ยังไม่มีรถ เริ่มที่ “ยี่ห้อและรุ่น” แล้วเพิ่มรถเข้าคลัง หรือนำเข้าทั้งหมดจากไฟล์ CSV |
| `Fleet.view.kind` | Kind of vehicle | ประเภทยานพาหนะ |
| `Fleet.reviewNews.added` | Added to Moto Mangos | เพิ่มใน Moto Mangos แล้ว |
| `Fleet.reviewNews.notAdded` | Not added to Moto Mangos | Moto Mangos ไม่ได้เพิ่ม |

## Kinds of vehicle

| Key | English | Thai |
| --- | --- | --- |
| `Fleet.kind.motorbike` | Motorbike | มอเตอร์ไซค์ |
| `Fleet.kind.car` | Car | รถยนต์ |
| `Fleet.kind.atv` | Off-road | ออฟโรด |
| `Fleet.kind.boat` | Boat or jet ski | เรือหรือเจ็ตสกี |
| `Fleet.kind.other` | Other | อื่น ๆ |

## Categories

| Key | English | Thai |
| --- | --- | --- |
| `Fleet.category.city_scooter` | Scooter | สกูตเตอร์ |
| `Fleet.category.touring` | Touring | ทัวริ่ง |
| `Fleet.category.adventure` | Adventure | แอดเวนเจอร์ |
| `Fleet.category.sport` | Sport | สปอร์ต |
| `Fleet.category.classic` | Classic | คลาสสิก |
| `Fleet.category.off_road` | Off-road | ออฟโรด |
| `Fleet.category.sedan` | Sedan | ซีดาน |
| `Fleet.category.suv` | SUV | เอสยูวี |
| `Fleet.category.pickup` | Pickup | กระบะ |
| `Fleet.category.van` | Van | รถตู้ |
| `Fleet.category.hatchback` | Hatchback | แฮทช์แบ็ก |
| `Fleet.category.convertible` | Convertible | เปิดประทุน |
| `Fleet.category.atv` | ATV | เอทีวี |
| `Fleet.category.utv` | UTV | ยูทีวี |
| `Fleet.category.jet_ski` | Jet ski | เจ็ตสกี |
| `Fleet.category.speedboat` | Speedboat | สปีดโบ๊ต |
| `Fleet.category.pontoon` | Pontoon | เรือพอนทูน |

## Make & model form

| Key | English | Thai |
| --- | --- | --- |
| `Fleet.what.kindLegend` | What kind of vehicle is it? | เป็นยานพาหนะประเภทไหน |
| `Fleet.what.make` | Make | ยี่ห้อ |
| `Fleet.what.makeHelp` | Pick an existing make, or type a new one. | เลือกยี่ห้อที่มีอยู่ หรือพิมพ์ยี่ห้อใหม่ |
| `Fleet.what.model` | Model | รุ่น |
| `Fleet.what.listHelp` | The Moto Mangos list. A model picked from it can be listed there with no extra step. | รายการของ Moto Mangos รุ่นที่เลือกจากรายการนี้ลงประกาศที่นั่นได้โดยไม่ต้องทำอะไรเพิ่ม |
| `Fleet.what.typeIt` | Not in the list? Type it in | ไม่มีในรายการ? พิมพ์เอง |
| `Fleet.what.useList` | Choose from the list instead | เลือกจากรายการแทน |
| `Fleet.what.cc` | Engine size (cc) | ขนาดเครื่องยนต์ (ซีซี) |
| `Fleet.what.transmission` | Transmission | ระบบเกียร์ |
| `Fleet.what.optional` | Optional. | ไม่บังคับ |
| `Fleet.what.category` | Category | หมวด |
| `Fleet.what.categoryHelp` | Helps renters find it when they search and filter. | ช่วยให้ผู้เช่าค้นหาและกรองเจอ |
| `Fleet.what.categoryOptional` | Optional. Helps renters find it when they search and filter. | ไม่บังคับ ช่วยให้ผู้เช่าค้นหาและกรองเจอ |
| `Fleet.what.card.intro` | The online marketplace where renters in your area find motorbikes to rent. | ตลาดออนไลน์ที่ผู้เช่าในพื้นที่ของคุณหามอเตอร์ไซค์เช่า |
| `Fleet.what.card.onList` | This model is on the Moto Mangos list. After saving, you can list it from its page. | รุ่นนี้อยู่ในรายการของ Moto Mangos หลังบันทึกแล้วลงประกาศได้จากหน้าของรุ่น |
| `Fleet.what.card.pick` | Pick a model above to see whether it is on the Moto Mangos list. | เลือกรุ่นด้านบนเพื่อดูว่าอยู่ในรายการของ Moto Mangos หรือไม่ |
| `Fleet.what.card.notOnList` | Not on the Moto Mangos list yet. After saving, you can send it for review from its page. | ยังไม่อยู่ในรายการของ Moto Mangos หลังบันทึกแล้วส่งให้ตรวจได้จากหน้าของรุ่น |
| `Fleet.model.newTitle` | Add a make & model | เพิ่มยี่ห้อและรุ่น |
| `Fleet.model.newIntro` | A kind of vehicle you rent out, like a Honda Click 160. Add the vehicles themselves afterwards, with “Add to inventory”. | ยานพาหนะแบบหนึ่งที่ร้านให้เช่า เช่น Honda Click 160 จากนั้นเพิ่มรถแต่ละคันด้วย “เพิ่มเข้าคลังรถ” |
| `Fleet.model.nameHelpNew` | Optional. Your own name for it; blank uses the make and model. | ไม่บังคับ ชื่อที่ร้านใช้เรียก เว้นว่างจะใช้ยี่ห้อและรุ่น |
| `Fleet.model.saveNew` | Save make & model | บันทึกยี่ห้อและรุ่น |
| `Fleet.model.saveThenInventory` | Save and add a vehicle | บันทึกแล้วเพิ่มรถ |

## Add to inventory form

| Key | English | Thai |
| --- | --- | --- |
| `Fleet.unit.newTitle` | Add to inventory | เพิ่มเข้าคลังรถ |
| `Fleet.unit.newIntro` | One vehicle of a make & model you already have. | รถหนึ่งคันของยี่ห้อและรุ่นที่ร้านมีอยู่แล้ว |
| `Fleet.unit.modelHelp` | Only your own makes & models are listed. | แสดงเฉพาะยี่ห้อและรุ่นของร้าน |
| `Fleet.unit.makeOrModelMissing` | Make & model not here? Add it first | ไม่มียี่ห้อและรุ่นที่ต้องการ? เพิ่มก่อน |
| `Fleet.unit.noModelsYet` | Add a make & model first. Then come back to add the vehicles you have of it. | เพิ่มยี่ห้อและรุ่นก่อน แล้วกลับมาเพิ่มรถที่ร้านมี |

## Moto Mangos panel

| Key | English | Thai |
| --- | --- | --- |
| `Fleet.motoMangos.approved` | Moto Mangos added this model to its list on {date}. | Moto Mangos เพิ่มรุ่นนี้เข้ารายการเมื่อ {date} |
| `Fleet.motoMangos.categoryFirst` | Choose a category for this model in the form on this page, save, and then you can send it to Moto Mangos. | เลือกหมวดของรุ่นนี้ในฟอร์มบนหน้านี้แล้วบันทึก จากนั้นจึงส่งให้ Moto Mangos ได้ |

## CSV import

| Key | English | Thai |
| --- | --- | --- |
| `Fleet.import.columnsHelp` | “make” and “model” are required. If they match the Moto Mangos list below, the vehicle goes on that entry; where a model has several generations, “model_year” picks the right one. If they don't match, the vehicle goes on a make & model of your own, which is created if you don't have it yet: give “vehicle_type” (motorbike, car, atv, boat or other; blank means motorbike) and “category” (the choices are under Categories below; required for a motorbike or a car). A motorbike also needs “cc” and “transmission” (automatic, semi_auto or manual); for other vehicles both are optional. “name” is optional: your own name for the make & model. Leave “plate” blank for a vehicle without one yet. Dates are YYYY-MM-DD; odometer is in {unit}; purchase price is in {currency}. | ต้องมี “make” และ “model” หากตรงกับรายการของ Moto Mangos ด้านล่าง รถจะอยู่ในรายการนั้น หากรุ่นมีหลายเจเนอเรชัน “model_year” จะเลือกรายการที่ถูกต้อง หากไม่ตรง รถจะอยู่ในยี่ห้อและรุ่นของร้านเอง ซึ่งจะถูกสร้างให้ถ้ายังไม่มี: ระบุ “vehicle_type” (motorbike, car, atv, boat หรือ other เว้นว่างหมายถึง motorbike) และ “category” (ตัวเลือกอยู่ใต้หัวข้อ หมวด ด้านล่าง บังคับสำหรับมอเตอร์ไซค์และรถยนต์) มอเตอร์ไซค์ต้องมี “cc” และ “transmission” (automatic, semi_auto หรือ manual) ด้วย สำหรับยานพาหนะประเภทอื่นไม่บังคับ “name” ไม่บังคับ: ชื่อที่ร้านใช้เรียกยี่ห้อและรุ่น เว้น “plate” ว่างสำหรับรถที่ยังไม่มีทะเบียน วันที่เป็น YYYY-MM-DD เลขไมล์เป็น {unit} ราคาซื้อเป็น {currency} |
| `Fleet.import.categories` | Categories | หมวด |
| `Fleet.import.categoriesHelp` | What to write in the “category” column, for each kind of vehicle. | สิ่งที่เขียนในคอลัมน์ “category” ของยานพาหนะแต่ละประเภท |
| `Fleet.import.errors.invalidCategory` | This isn't one of the categories for that kind of vehicle. | ไม่ใช่หมวดของยานพาหนะประเภทนั้น |
| `Fleet.import.errors.ownNeedsCategory` | A new motorbike or car needs a “category”. | มอเตอร์ไซค์หรือรถยนต์ที่เพิ่มใหม่ต้องมี “category” |

## Errors

| Key | English | Thai |
| --- | --- | --- |
| `FormErrors.invalidCategory` | Choose one of the categories in the list. | เลือกหมวดจากรายการ |
| `FormErrors.categoryFirst` | Choose a category for this model and save it first, then send it. | เลือกหมวดของรุ่นนี้แล้วบันทึกก่อน จากนั้นจึงส่ง |

## Dashboard

| Key | English | Thai |
| --- | --- | --- |
| `Dashboard.motoMangos.title` | Moto Mangos reviews | ผลการตรวจจาก Moto Mangos |
| `Dashboard.motoMangos.added` | Added to the Moto Mangos list | เพิ่มเข้ารายการ Moto Mangos แล้ว |
| `Dashboard.motoMangos.notAdded` | Not added: see why | ไม่ได้เพิ่ม: ดูเหตุผล |
