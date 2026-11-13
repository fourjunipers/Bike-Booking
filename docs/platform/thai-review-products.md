# Thai lines to review: products, stage A (13 Nov 2026)

New or changed Thai texts in `apps/platform/messages/th.json` on the branch `platform/products-stage-a`. They are Claude's translations and need a native check by Korn or BSR's admin. Correct them in `th.json` (the key is in the first column); this file can be deleted once they are approved.

**The word for "product" is สินค้า, provisional** (owner, 13 Nov 2026). It is used for things that are rented, not only sold. If another word is chosen, it is one find-and-replace of สินค้า in `th.json`; the lines that use it are all in this list or in `docs/platform/thai-review-fleet-rework.md`.

"Vehicle" stays รถ (counted in คัน) for a vehicle unit, as before. The Fleet menu entry stays รถทั้งหมด.

Gone: `Fleet.what.typeIt`, `Fleet.what.useList`, `Fleet.what.notInList` (the create form has one type-ahead now, no "Manually enter" button).

| Key | English | Thai |
| --- | --- | --- |
| `Nav.products` | Products | สินค้า |
| `Products.title` | Products | สินค้า |
| `Products.intro` | {count, plural, =0 {No products yet} one {# product} other {# products}}: what you rent out. Each vehicle you own sits under its product. | {count, plural, =0 {ยังไม่มีสินค้า} other {สินค้า # รายการ}}: สิ่งที่ร้านให้เช่า รถแต่ละคันของร้านอยู่ภายใต้สินค้าของมัน |
| `Products.new` | New product | สินค้าใหม่ |
| `Products.empty` | Nothing here yet. Start with “New product”, then add your vehicles to it, or import them all from a CSV file on the Fleet page. | ยังไม่มีสินค้า เริ่มที่ “สินค้าใหม่” แล้วเพิ่มรถของร้านไว้ใต้สินค้านั้น หรือนำเข้าทั้งหมดจากไฟล์ CSV ที่หน้ารถทั้งหมด |
| `Products.searchLabel` | Find a product | ค้นหาสินค้า |
| `Products.searchPlaceholder` | Name, make or model | ชื่อ ยี่ห้อ หรือรุ่น |
| `Products.show` | Show | แสดง |
| `Products.scope.current` | In use | ใช้งานอยู่ |
| `Products.scope.retired` | Retired | ปลดระวาง |
| `Products.scope.all` | Everything | ทั้งหมด |
| `Products.motoMangos` | Moto Mangos | Moto Mangos |
| `Products.list` | Products | รายการสินค้า |
| `Products.noMatch` | No product matches. Change the search or the filters. | ไม่พบสินค้าที่ตรงกัน ลองเปลี่ยนคำค้นหาหรือตัวกรอง |
| `Products.showing` | Showing {shown} of {total} | แสดง {shown} จาก {total} |
| `Products.type.vehicle` | Vehicle | ยานพาหนะ |
| `Products.type.gear` | Rental gear | อุปกรณ์ให้เช่า |
| `Products.type.sale_item` | Item for sale | สินค้าสำหรับขาย |
| `Products.type.service` | Service | บริการ |
| `Products.stock` | {count, plural, =0 {No vehicles in the fleet} one {# vehicle in the fleet} other {# vehicles in the fleet}} | {count, plural, =0 {ไม่มีรถในฟลีต} other {รถในฟลีต # คัน}} |
| `Products.stockPast` | {count} sold or retired | ขายแล้วหรือปลดระวาง {count} คัน |
| `Products.open` | Open {name} | เปิด {name} |
| `Products.tabs.label` | Sections of this product | ส่วนต่าง ๆ ของสินค้านี้ |
| `Products.tabs.details` | Details | รายละเอียด |
| `Products.tabs.units` | Units | รถของสินค้านี้ |
| `Products.tabs.history` | History | ประวัติ |
| `Products.added` | Product saved. Add its vehicles on the Units tab. | บันทึกสินค้าแล้ว เพิ่มรถของสินค้านี้ได้ที่แท็บรถของสินค้านี้ |
| `Products.readOnly` | You can view this product but not change it. | คุณดูสินค้านี้ได้ แต่แก้ไขไม่ได้ |
| `Products.seeInFleet` | See these vehicles in Fleet | ดูรถเหล่านี้ในหน้ารถทั้งหมด |
| `Products.history.intro` | Who changed what on this product and its vehicles, newest first. | ใครเปลี่ยนอะไรในสินค้านี้และรถของสินค้านี้ เรียงจากล่าสุด |
| `Products.history.none` | No changes recorded yet. | ยังไม่มีการเปลี่ยนแปลงที่บันทึกไว้ |
| `Products.history.latest` | Showing the latest {count} changes. | แสดงการเปลี่ยนแปลงล่าสุด {count} รายการ |
| `Products.history.system` | The system | ระบบ |
| `Products.history.formerMember` | Someone no longer in the team | ผู้ที่ไม่ได้อยู่ในทีมแล้ว |
| `Products.history.on.products` | this product | สินค้านี้ |
| `Products.history.on.units` | vehicle {name} | รถ {name} |
| `Products.history.on.product_year_bands` | a year band | ช่วงปีรุ่น |
| `Products.history.action.insert` | {who} added {what} | {who} เพิ่ม{what} |
| `Products.history.action.update` | {who} changed {what} | {who} แก้ไข{what} |
| `Products.history.action.delete` | {who} deleted {what} | {who} ลบ{what} |
| `Products.history.action.clamp_booking_counts` | Booking counts were lowered on {what} because a vehicle left the fleet | จำนวนรถที่เปิดจองของ{what}ถูกปรับลด เพราะมีรถออกจากฟลีต |
| `Products.history.action.other` | {who}: {action} on {what} | {who}: {action} ที่{what} |
| `Products.history.change` | {field}: {from} → {to} | {field}: {from} → {to} |
| `Products.history.empty` | (empty) | (ว่าง) |
| `Products.history.yes` | yes | ใช่ |
| `Products.history.no` | no | ไม่ |
| `Products.history.field.name` | Name | ชื่อ |
| `Products.history.field.description` | Description | คำอธิบาย |
| `Products.history.field.make` | Make | ยี่ห้อ |
| `Products.history.field.model` | Model | รุ่น |
| `Products.history.field.cc` | Engine size | ขนาดเครื่องยนต์ |
| `Products.history.field.transmission` | Transmission | ระบบเกียร์ |
| `Products.history.field.categories` | Categories | หมวดหมู่ |
| `Products.history.field.deposit` | Deposit (minor units) | เงินมัดจำ (หน่วยย่อย) |
| `Products.history.field.bookable_online` | Can be booked online | จองออนไลน์ได้ |
| `Products.history.field.marketplace_listed` | Listed on Moto Mangos | ลงประกาศบน Moto Mangos |
| `Products.history.field.instant_units` | Instant units | จำนวนคันที่ยืนยันทันที |
| `Products.history.field.request_units` | Request units | จำนวนคันที่ต้องขออนุมัติ |
| `Products.history.field.ready_now` | Ready for walk-ins | พร้อมสำหรับลูกค้าหน้าร้าน |
| `Products.history.field.retired_at` | Retired | ปลดระวาง |
| `Products.history.field.catalog_id` | Known model | รุ่นในรายการ |
| `Products.history.field.plate` | Plate | ทะเบียน |
| `Products.history.field.status` | Status | สถานะ |
| `Products.history.field.current_odometer_km` | Odometer (km) | เลขไมล์ (กม.) |
| `Products.history.field.colour` | Colour | สี |
| `Products.history.field.model_year` | Model year | ปีรุ่น |
| `Products.history.field.notes` | Notes | หมายเหตุ |
| `Fleet.intro` | {units, plural, =0 {No vehicles yet} one {# vehicle} other {# vehicles}} in {models, plural, one {# product} other {# products}}. | {units, plural, =0 {ยังไม่มีรถ} other {รถ # คัน}} ใน {models, plural, other {สินค้า # รายการ}} |
| `Fleet.empty` | No vehicles yet. Add a product on the Products page, then add your vehicles to it, or import them all from a CSV file. | ยังไม่มีรถ เพิ่มสินค้าที่หน้าสินค้า แล้วเพิ่มรถของร้านไว้ใต้สินค้านั้น หรือนำเข้าทั้งหมดจากไฟล์ CSV |
| `Fleet.addUnit` | Add vehicle | เพิ่มรถ |
| `Fleet.addUnitRow` | Add vehicle | เพิ่มรถ |
| `Fleet.noUnits` | No vehicles of this product yet. | ยังไม่มีรถของสินค้านี้ |
| `Fleet.editModel` | Open product | เปิดสินค้า |
| `Fleet.model.newTitle` | New product | สินค้าใหม่ |
| `Fleet.model.editTitle` | Product | สินค้า |
| `Fleet.model.nameHelp` | Your own name for it. Several products can share one known model. | ชื่อที่ร้านใช้เรียก สินค้าหลายรายการใช้รุ่นเดียวกันในรายการได้ |
| `Fleet.model.units` | Vehicles of this product | รถของสินค้านี้ |
| `Fleet.model.delete` | Delete product | ลบสินค้า |
| `Fleet.model.deleteConfirm` | Delete this product? This can't be undone. | ลบสินค้านี้หรือไม่? ไม่สามารถย้อนกลับได้ |
| `Fleet.model.newIntro` | Something you rent out, like a Honda Click 160. Add the vehicles themselves afterwards, on the product's Units tab. | สิ่งที่ร้านให้เช่า เช่น Honda Click 160 จากนั้นเพิ่มรถแต่ละคันที่แท็บรถของสินค้านี้ |
| `Fleet.model.saveNew` | Save product | บันทึกสินค้า |
| `Fleet.model.retire` | Retire product | ปลดระวางสินค้า |
| `Fleet.model.retireConfirm` | Retire this product? It leaves the Products and Fleet lists and the “Add vehicle” form, and comes off Moto Mangos. Its vehicles and their history are kept, and you can restore it later. | ปลดระวางสินค้านี้หรือไม่ จะออกจากรายการสินค้า รายการรถ และฟอร์ม “เพิ่มรถ” และออกจาก Moto Mangos รถและประวัติยังอยู่ และนำกลับมาใช้ภายหลังได้ |
| `Fleet.model.retiredOn` | Retired on {date}. It is hidden from the Products and Fleet lists and from “Add vehicle”, and is not listed on Moto Mangos. Find it under Show: Retired. | ปลดระวางเมื่อ {date} ถูกซ่อนจากรายการสินค้า รายการรถ และจาก “เพิ่มรถ” และไม่ได้ลงประกาศบน Moto Mangos ดูได้ที่ แสดง: ปลดระวาง |
| `Fleet.model.restore` | Restore product | นำสินค้ากลับมาใช้ |
| `Fleet.model.deleteConfirmWaiting` | Delete this product? This can't be undone. Its Moto Mangos review request will be withdrawn. | ลบสินค้านี้หรือไม่ การลบไม่สามารถย้อนกลับได้ คำขอตรวจกับ Moto Mangos จะถูกถอน |
| `Fleet.unit.newTitle` | Add vehicle | เพิ่มรถ |
| `Fleet.unit.model` | Product | สินค้า |
| `Fleet.unit.makeOrModelMissing` | Product not here? Add it first | ไม่มีสินค้าที่ต้องการ? เพิ่มก่อน |
| `Fleet.unit.newIntro` | One vehicle of a product you already have. | รถหนึ่งคันของสินค้าที่ร้านมีอยู่แล้ว |
| `Fleet.unit.modelHelp` | Only your own products are listed. | แสดงเฉพาะสินค้าของร้าน |
| `Fleet.unit.noModelsYet` | Add a product first. Then come back to add the vehicles you have of it. | เพิ่มสินค้าก่อน แล้วกลับมาเพิ่มรถที่ร้านมี |
| `Fleet.import.done` | Imported {units, plural, one {# vehicle} other {# vehicles}} and {products, plural, =0 {no new products} one {# new product} other {# new products}}. | นำเข้า {units, plural, other {รถ # คัน}} และ {products, plural, =0 {ไม่มีสินค้าใหม่} other {สินค้าใหม่ # รายการ}} |
| `Fleet.motoMangos.categoryFirst` | Choose a category for this model on the Details tab, save, and then you can send it to Moto Mangos. | เลือกหมวดหมู่ของรุ่นนี้ที่แท็บรายละเอียด บันทึก แล้วจึงส่งให้ Moto Mangos ได้ |
| `Fleet.what.makeModel` | Make and model | ยี่ห้อและรุ่น |
| `Fleet.what.makeModelPlaceholder` | e.g. Honda PCX 160 | เช่น Honda PCX 160 |
| `Fleet.what.makeModelHelp` | Start typing and pick your model when it appears: its details are filled in for you. If it doesn't appear, just keep typing. | เริ่มพิมพ์ แล้วเลือกรุ่นของคุณเมื่อปรากฏ ระบบจะกรอกรายละเอียดให้ หากไม่ปรากฏ ให้พิมพ์ต่อได้เลย |
| `Fleet.what.makeModelHelpTyped` | Type the make and model, e.g. Toyota Yaris. | พิมพ์ยี่ห้อและรุ่น เช่น Toyota Yaris |
| `Fleet.what.suggestions` | Known models | รุ่นที่มีในรายการ |
| `Fleet.what.filled` | Filled in from the known model | กรอกจากรุ่นในรายการ |
| `Fleet.what.filledHelp` | Filled in for you. To use a different model, type over the name above. | ระบบกรอกให้แล้ว หากต้องการใช้รุ่นอื่น ให้พิมพ์ทับชื่อด้านบน |
| `Fleet.what.notKnown` | We don't know this model yet. Check the make and model below and add its details. | เรายังไม่รู้จักรุ่นนี้ ตรวจยี่ห้อและรุ่นด้านล่าง แล้วเพิ่มรายละเอียด |
| `Fleet.what.makeHelp` | Taken from what you typed. Correct it if the make has more than one word. | มาจากที่คุณพิมพ์ แก้ไขได้หากยี่ห้อมีมากกว่าหนึ่งคำ |
| `Fleet.what.tip.fromList` | This is a known model, so it can be listed on Moto Mangos, the marketplace that matches renters with rental providers. | รุ่นนี้อยู่ในรายการแล้ว จึงลงประกาศบน Moto Mangos ได้ ซึ่งเป็นตลาดที่จับคู่ผู้เช่ากับผู้ให้เช่า |
| `Fleet.what.tip.typed` | To add this vehicle to the Moto Mangos marketplace, save it first, then send it for review from its product page. | หากต้องการเพิ่มรถคันนี้ในตลาด Moto Mangos ให้บันทึกก่อน แล้วส่งให้ตรวจจากหน้าสินค้า |
| `FormErrors.inPresets` | This make and model is a known model. Pick it from the suggestions instead. | ยี่ห้อและรุ่นนี้มีอยู่ในรายการแล้ว ให้เลือกจากรายการที่แนะนำแทน |
| `FormErrors.model_retired` | This product is retired. Restore it first. | สินค้านี้ปลดระวางแล้ว กรุณานำกลับมาใช้ก่อน |
| `FormErrors.model_has_active_units` | Retire or sell its vehicles first. A product can be retired once none of its vehicles is in the fleet. | ปลดระวางหรือขายรถของสินค้านี้ก่อน สินค้าจะปลดระวางได้เมื่อไม่มีรถคันใดอยู่ในฟลีตแล้ว |
| `FormErrors.ownModelExists` | You already have a product with this make and model. | ร้านมีสินค้ายี่ห้อและรุ่นนี้อยู่แล้ว |
| `Fleet.import.columnsHelp` | “make” and “model” are required. If they match the Moto Mangos list below, the vehicle goes on that entry; where a model has several generations, “model_year” picks the right one. If they don't match, the vehicle goes on a product of your own, which is created if you don't have it yet: give “vehicle_type” (motorbike, car, atv, boat or other; blank means motorbike) and “category” (the choices are under Categories below; required for a motorbike or a car; for several, separate them with a semicolon, like “adventure; touring”). A motorbike also needs “cc” and “transmission” (automatic, semi_auto or manual); for other vehicles both are optional. “name” is optional: your own name for the product. Leave “plate” blank for a vehicle without one yet. Dates are YYYY-MM-DD; odometer is in {unit}; purchase price is in {currency}. | ต้องมี “make” และ “model” หากตรงกับรายการของ Moto Mangos ด้านล่าง รถจะอยู่ในรายการนั้น หากรุ่นมีหลายเจเนอเรชัน “model_year” จะเลือกรายการที่ถูกต้อง หากไม่ตรง รถจะอยู่ในสินค้าของร้านเอง ซึ่งจะถูกสร้างให้ถ้ายังไม่มี: ระบุ “vehicle_type” (motorbike, car, atv, boat หรือ other เว้นว่างหมายถึง motorbike) และ “category” (ตัวเลือกอยู่ใต้หัวข้อ หมวด ด้านล่าง บังคับสำหรับมอเตอร์ไซค์และรถยนต์ หากมีหลายหมวดให้คั่นด้วยเครื่องหมาย ; เช่น “adventure; touring”) มอเตอร์ไซค์ต้องมี “cc” และ “transmission” (automatic, semi_auto หรือ manual) ด้วย สำหรับยานพาหนะประเภทอื่นไม่บังคับ “name” ไม่บังคับ: ชื่อที่ร้านใช้เรียกสินค้า เว้น “plate” ว่างสำหรับรถที่ยังไม่มีทะเบียน วันที่เป็น YYYY-MM-DD เลขไมล์เป็น {unit} ราคาซื้อเป็น {currency} |
| `Fleet.view.group.model` | Product | สินค้า |
| `Fleet.bands.intro` | How the Fleet list splits this product by model year. With none, it shows one group for all years. | วิธีที่หน้ารถทั้งหมดแบ่งสินค้านี้ตามปีของรุ่น หากไม่มี จะแสดงกลุ่มเดียวสำหรับทุกปี |
