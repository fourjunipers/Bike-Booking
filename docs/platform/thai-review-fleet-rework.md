# Thai lines to review: fleet rework (12 Nov 2026)

New or changed Thai texts in `apps/platform/messages/th.json` on the branch `platform/fleet-rework`. They are Claude's translations and need a native check. Correct them in `th.json` (the key is in the first column); this file can be deleted once they are approved.

Thai already used the general word for a vehicle (รถ, counted in คัน) wherever English said “bike”, so the bike-to-vehicle change needed no Thai edits beyond the lines below.

## Fourth round: deleting and retiring (12 Nov 2026, night)

All new: the refused-delete message with “Retire instead”, “Restore”, the confirmations for retiring and selling, and retiring a make & model.

| Key | English | Thai |
| --- | --- | --- |
| `FormErrors.unitInUse` | This vehicle has downtime or bookings on record, so it can't be deleted. You can retire it instead: it leaves the fleet list and can't be rented, and its history is kept. | รถคันนี้มีประวัติการหยุดใช้งานหรือการจอง จึงลบไม่ได้ คุณปลดระวางแทนได้: รถจะออกจากรายการรถและเช่าไม่ได้ แต่ประวัติยังอยู่ |
| `FormErrors.model_has_active_units` | Retire or sell its vehicles first. A make & model can be retired once none of its vehicles is in the fleet. | ปลดระวางหรือขายรถของรุ่นนี้ก่อน ยี่ห้อและรุ่นจะปลดระวางได้เมื่อไม่มีรถคันใดอยู่ในฟลีตแล้ว |
| `FormErrors.model_retired` | This make & model is retired. Restore it first. | ยี่ห้อและรุ่นนี้ปลดระวางแล้ว กรุณานำกลับมาใช้ก่อน |
| `Fleet.unit.retireInstead` | Retire instead | ปลดระวางแทน |
| `Fleet.unit.restore` | Restore | นำกลับมาใช้ |
| `Fleet.unit.restoreHelp` | Retired vehicles are out of the fleet. Restore puts this one back as active. | รถที่ปลดระวางแล้วไม่อยู่ในฟลีต การนำกลับมาใช้จะทำให้รถคันนี้กลับเป็นพร้อมใช้งาน |
| `Fleet.unit.retireConfirm` | Retire this vehicle? It leaves the fleet list and can't be rented or booked. Its history is kept, and you can restore it later. | ปลดระวางรถคันนี้หรือไม่ รถจะออกจากรายการรถ และเช่าหรือจองไม่ได้ ประวัติยังอยู่ และนำกลับมาใช้ภายหลังได้ |
| `Fleet.unit.sellConfirm` | Mark this vehicle as sold? It leaves the fleet list and can't be rented or booked. Its history is kept. You fill in the sale details next. | ทำเครื่องหมายว่ารถคันนี้ขายแล้วหรือไม่ รถจะออกจากรายการรถ และเช่าหรือจองไม่ได้ ประวัติยังอยู่ จากนั้นกรอกรายละเอียดการขาย |
| `Fleet.model.retire` | Retire make & model | ปลดระวางยี่ห้อและรุ่น |
| `Fleet.model.retireConfirm` | Retire this make & model? It leaves the fleet list and the “Add to inventory” form, and comes off Moto Mangos. Its vehicles and their history are kept, and you can restore it later. | ปลดระวางยี่ห้อและรุ่นนี้หรือไม่ จะออกจากรายการรถและฟอร์ม “เพิ่มเข้าคลังรถ” และออกจาก Moto Mangos รถและประวัติยังอยู่ และนำกลับมาใช้ภายหลังได้ |
| `Fleet.model.retiredTitle` | Retired | ปลดระวางแล้ว |
| `Fleet.model.retiredOn` | Retired on {date}. It is hidden from the fleet list and from “Add to inventory”, and is not listed on Moto Mangos. Find it under Show: Sold and retired. | ปลดระวางเมื่อ {date} ถูกซ่อนจากรายการรถและจาก “เพิ่มเข้าคลังรถ” และไม่ได้ลงประกาศบน Moto Mangos ดูได้ที่ แสดง: ขายแล้วและปลดระวาง |
| `Fleet.model.restore` | Restore make & model | นำยี่ห้อและรุ่นกลับมาใช้ |
| `Fleet.model.deleteConfirmWaiting` | Delete this model? This can't be undone. Its Moto Mangos review request will be withdrawn. | ลบรุ่นนี้หรือไม่ การลบไม่สามารถย้อนกลับได้ คำขอตรวจกับ Moto Mangos จะถูกถอน |
| `Fleet.listing.retired` | Retired | ปลดระวางแล้ว |

## Third round (12 Nov 2026, late)

New or changed in the third round: the “Manually enter” button and its question, the Moto Mangos chips on the Fleet list, the new text for a model that isn’t on the list, and “what to do next” for a model that was not added. Gone: `Fleet.what.listHelp`, `Fleet.motoMangos.submitHelp` and the two `Fleet.reviewNews.*` lines.

| Key | English | Thai |
| --- | --- | --- |
| `Fleet.what.typeIt` | Manually enter | กรอกเอง |
| `Fleet.what.notInList` | Don’t see your bike in the list? | ไม่เห็นรถของคุณในรายการ? |
| `Fleet.listing.listed` | Listed on Moto Mangos | ลงประกาศบน Moto Mangos แล้ว |
| `Fleet.listing.inReview` | In review | กำลังตรวจ |
| `Fleet.listing.needsChanges` | Needs changes | ต้องแก้ไข |
| `Fleet.listing.notListed` | Not listed | ยังไม่ลงประกาศ |
| `Fleet.modelFacts` | About {name} | เกี่ยวกับ {name} |
| `Fleet.motoMangos.notOnList` | This make and model isn’t on the Moto Mangos list yet. You can still list it: switch it on and we’ll review it first, because it’s a new make and model. It goes live once approved. Or choose a model from the list to skip the review. | ยี่ห้อและรุ่นนี้ยังไม่อยู่ในรายการของ Moto Mangos แต่ยังลงประกาศได้: เปิดใช้งานแล้วเราจะตรวจก่อน เพราะเป็นยี่ห้อและรุ่นใหม่ เมื่ออนุมัติแล้วจะขึ้นแสดงทันที หรือเลือกรุ่นจากรายการเพื่อข้ามการตรวจ |
| `Fleet.motoMangos.waiting` | Sent to Moto Mangos. It is waiting for review and goes live once approved; you can keep using the model meanwhile. | ส่งให้ Moto Mangos แล้ว กำลังรอตรวจ และจะขึ้นแสดงเมื่ออนุมัติ ระหว่างนี้ใช้งานรุ่นนี้ต่อได้ |
| `Fleet.motoMangos.submitTitle` | List it on Moto Mangos | ลงประกาศบน Moto Mangos |
| `Fleet.motoMangos.submit` | Switch on and send for review | เปิดใช้งานและส่งให้ตรวจ |
| `Fleet.motoMangos.submitAgain` | Send for review again | ส่งให้ตรวจอีกครั้ง |
| `Fleet.motoMangos.nextTitle` | What to do next | ต้องทำอะไรต่อ |
| `Fleet.motoMangos.nextHelp` | Fix the details and send it for review again, or switch to a model that is already on the list. | แก้ไขรายละเอียดแล้วส่งให้ตรวจอีกครั้ง หรือเปลี่ยนไปใช้รุ่นที่อยู่ในรายการอยู่แล้ว |
| `Fleet.motoMangos.editAgain` | Edit and send again | แก้ไขแล้วส่งอีกครั้ง |
| `Fleet.motoMangos.chooseInstead` | Choose a model from the list instead | เลือกรุ่นจากรายการแทน |
| `Fleet.motoMangos.chooseTitle` | Choose a model from the list | เลือกรุ่นจากรายการ |
| `Fleet.motoMangos.chooseHelp` | It takes the list’s make, model and specs, and needs no review. | จะใช้ยี่ห้อ รุ่น และสเปกตามรายการ และไม่ต้องรอตรวจ |
| `Fleet.motoMangos.useChosen` | Use this model | ใช้รุ่นนี้ |

## Second round (after the click-through, 12 Nov 2026)

New or changed since the first list: the “+ Vehicle” row button, the category filter, several categories per model, and the helpful tip beside the make and model. The four `Fleet.what.card.*` lines are gone (the tip replaced the card). The lines that changed are repeated here and updated in their tables below.

| Key | English | Thai |
| --- | --- | --- |
| `Fleet.addUnitRow` | Vehicle | รถ |
| `Fleet.view.category` | Category | หมวด |
| `Fleet.what.typeIt` | Manually enter | กรอกเอง |
| `Fleet.what.category` | Categories | หมวด |
| `Fleet.what.categoryHelp` | Choose at least one; you can choose several. Helps renters find it when they search and filter. | เลือกอย่างน้อยหนึ่งหมวด เลือกได้หลายหมวด ช่วยให้ผู้เช่าค้นหาและกรองเจอ |
| `Fleet.what.categoryOptional` | Optional; you can choose several. Helps renters find it when they search and filter. | ไม่บังคับ เลือกได้หลายหมวด ช่วยให้ผู้เช่าค้นหาและกรองเจอ |
| `Fleet.what.tip.label` | Helpful tip | เคล็ดลับ |
| `Fleet.what.tip.fromList` | Any model from this list can be listed on Moto Mangos, the marketplace that matches renters with rental providers. | ทุกรุ่นในรายการนี้ลงประกาศบน Moto Mangos ได้ ซึ่งเป็นตลาดที่จับคู่ผู้เช่ากับผู้ให้เช่า |
| `Fleet.what.tip.typed` | To add this vehicle to the Moto Mangos marketplace, save it first, then send it for review from its details page. | หากต้องการเพิ่มรถคันนี้ในตลาด Moto Mangos ให้บันทึกก่อน แล้วส่งให้ตรวจจากหน้ารายละเอียดของรุ่น |
| `Fleet.import.columnsHelp` | “make” and “model” are required. If they match the Moto Mangos list below, the vehicle goes on that entry; where a model has several generations, “model_year” picks the right one. If they don't match, the vehicle goes on a make & model of your own, which is created if you don't have it yet: give “vehicle_type” (motorbike, car, atv, boat or other; blank means motorbike) and “category” (the choices are under Categories below; required for a motorbike or a car; for several, separate them with a semicolon, like “adventure; touring”). A motorbike also needs “cc” and “transmission” (automatic, semi_auto or manual); for other vehicles both are optional. “name” is optional: your own name for the make & model. Leave “plate” blank for a vehicle without one yet. Dates are YYYY-MM-DD; odometer is in {unit}; purchase price is in {currency}. | ต้องมี “make” และ “model” หากตรงกับรายการของ Moto Mangos ด้านล่าง รถจะอยู่ในรายการนั้น หากรุ่นมีหลายเจเนอเรชัน “model_year” จะเลือกรายการที่ถูกต้อง หากไม่ตรง รถจะอยู่ในยี่ห้อและรุ่นของร้านเอง ซึ่งจะถูกสร้างให้ถ้ายังไม่มี: ระบุ “vehicle_type” (motorbike, car, atv, boat หรือ other เว้นว่างหมายถึง motorbike) และ “category” (ตัวเลือกอยู่ใต้หัวข้อ หมวด ด้านล่าง บังคับสำหรับมอเตอร์ไซค์และรถยนต์ หากมีหลายหมวดให้คั่นด้วยเครื่องหมาย ; เช่น “adventure; touring”) มอเตอร์ไซค์ต้องมี “cc” และ “transmission” (automatic, semi_auto หรือ manual) ด้วย สำหรับยานพาหนะประเภทอื่นไม่บังคับ “name” ไม่บังคับ: ชื่อที่ร้านใช้เรียกยี่ห้อและรุ่น เว้น “plate” ว่างสำหรับรถที่ยังไม่มีทะเบียน วันที่เป็น YYYY-MM-DD เลขไมล์เป็น {unit} ราคาซื้อเป็น {currency} |
| `Fleet.import.categoriesHelp` | What to write in the “category” column, for each kind of vehicle. For more than one, put a semicolon between them. | สิ่งที่เขียนในคอลัมน์ “category” ของยานพาหนะแต่ละประเภท หากมีมากกว่าหนึ่งหมวด ให้คั่นด้วยเครื่องหมาย ; |

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
| `Fleet.what.typeIt` | Manually enter | กรอกเอง |
| `Fleet.what.useList` | Choose from the list instead | เลือกจากรายการแทน |
| `Fleet.what.cc` | Engine size (cc) | ขนาดเครื่องยนต์ (ซีซี) |
| `Fleet.what.transmission` | Transmission | ระบบเกียร์ |
| `Fleet.what.optional` | Optional. | ไม่บังคับ |
| `Fleet.what.category` | Categories | หมวด |
| `Fleet.what.categoryHelp` | Choose at least one; you can choose several. Helps renters find it when they search and filter. | เลือกอย่างน้อยหนึ่งหมวด เลือกได้หลายหมวด ช่วยให้ผู้เช่าค้นหาและกรองเจอ |
| `Fleet.what.categoryOptional` | Optional; you can choose several. Helps renters find it when they search and filter. | ไม่บังคับ เลือกได้หลายหมวด ช่วยให้ผู้เช่าค้นหาและกรองเจอ |
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
| `Fleet.import.columnsHelp` | “make” and “model” are required. If they match the Moto Mangos list below, the vehicle goes on that entry; where a model has several generations, “model_year” picks the right one. If they don't match, the vehicle goes on a make & model of your own, which is created if you don't have it yet: give “vehicle_type” (motorbike, car, atv, boat or other; blank means motorbike) and “category” (the choices are under Categories below; required for a motorbike or a car; for several, separate them with a semicolon, like “adventure; touring”). A motorbike also needs “cc” and “transmission” (automatic, semi_auto or manual); for other vehicles both are optional. “name” is optional: your own name for the make & model. Leave “plate” blank for a vehicle without one yet. Dates are YYYY-MM-DD; odometer is in {unit}; purchase price is in {currency}. | ต้องมี “make” และ “model” หากตรงกับรายการของ Moto Mangos ด้านล่าง รถจะอยู่ในรายการนั้น หากรุ่นมีหลายเจเนอเรชัน “model_year” จะเลือกรายการที่ถูกต้อง หากไม่ตรง รถจะอยู่ในยี่ห้อและรุ่นของร้านเอง ซึ่งจะถูกสร้างให้ถ้ายังไม่มี: ระบุ “vehicle_type” (motorbike, car, atv, boat หรือ other เว้นว่างหมายถึง motorbike) และ “category” (ตัวเลือกอยู่ใต้หัวข้อ หมวด ด้านล่าง บังคับสำหรับมอเตอร์ไซค์และรถยนต์ หากมีหลายหมวดให้คั่นด้วยเครื่องหมาย ; เช่น “adventure; touring”) มอเตอร์ไซค์ต้องมี “cc” และ “transmission” (automatic, semi_auto หรือ manual) ด้วย สำหรับยานพาหนะประเภทอื่นไม่บังคับ “name” ไม่บังคับ: ชื่อที่ร้านใช้เรียกยี่ห้อและรุ่น เว้น “plate” ว่างสำหรับรถที่ยังไม่มีทะเบียน วันที่เป็น YYYY-MM-DD เลขไมล์เป็น {unit} ราคาซื้อเป็น {currency} |
| `Fleet.import.categories` | Categories | หมวด |
| `Fleet.import.categoriesHelp` | What to write in the “category” column, for each kind of vehicle. For more than one, put a semicolon between them. | สิ่งที่เขียนในคอลัมน์ “category” ของยานพาหนะแต่ละประเภท หากมีมากกว่าหนึ่งหมวด ให้คั่นด้วยเครื่องหมาย ; |
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
