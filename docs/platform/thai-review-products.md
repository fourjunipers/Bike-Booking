# Thai lines to review: products, stage A (13 Nov 2026)

New or changed Thai texts in `apps/platform/messages/th.json` on the branch `platform/products-stage-a`. They are Claude's translations and need a native check by Korn or BSR's admin. Correct them in `th.json` (the key is in the first column); this file can be deleted once they are approved.

**The word for "product" is สินค้า, provisional** (owner, 13 Nov 2026). It is used for things that are rented, not only sold. If another word is chosen, it is one find-and-replace of สินค้า in `th.json`; the lines that use it are all in this list or in `docs/platform/thai-review-fleet-rework.md`.

"Vehicle" stays รถ (counted in คัน) for a vehicle unit, as before. The Fleet menu entry stays รถทั้งหมด.


**Second round (13 Nov 2026, after the owner's click-through).** The create form is a kind and a product name; the make-and-model type-ahead and its texts are gone (`Fleet.what.makeModel*`, `suggestions`, `filled*`, `notKnown`, `makeHelp`, `optional`, `tip.fromList`, `tip.typed`, `Fleet.model.nameHelpNew`, `FormErrors.inPresets`, `FormErrors.requiredSpecs`, and earlier `Fleet.what.typeIt`, `useList`, `notInList`). New or changed in this round: `Fleet.what.kindLegend`, `Fleet.what.tip.text`, `Fleet.category.dirt_bike` (Dirt bike, รถวิบาก: for approval), `Fleet.model.detailsTitle`, `name`, `namePlaceholder`, `nameHelp`, `Fleet.motoMangos.submitHelp`, `categoryFirst`, `FormErrors.specs_required`.

**Third round (13 Nov 2026).** Make and model are gone from the platform's screens; the Moto Mangos panel has a new order and new texts; buffers are in hours; Fleet is one line per product. New or changed in this round: `Fleet.list`, `vehicleCounts`, `searchPlaceholder`, `Fleet.unit.modelYear` (now "Year", ปี), `modelYearHelp`, `Fleet.model.removeTitle`, `namePlaceholder`, `nameHelp`, `bufferBefore`, `bufferAfter`, `bufferHelp`, `modesHelp`, `Products.duplicate`, `Products.searchPlaceholder`, `FormErrors.invalidHours`, `specs_required`, `Fleet.motoMangos.selectFromList`, `notInList`, `submitHelp`, `submit`, `bikeYear`, `bikeYearHelp`, `listingTitle`, `listingLocked`, `list`, `Fleet.what.tip.text`, `Fleet.import.columnsHelp`, and `Admin.years`, `yearFrom`, `yearTo`, `yearsHelp` (the Moto Mangos admin page). Gone: the make, model, engine-size and transmission labels and filters, the group-by and sort texts, "Did you mean", the year range on the shop's review form.

**Fourth round (13 Nov 2026).** New or changed: `Fleet.editModel` (the pencil: "Edit product"), `Fleet.motoMangos.useChosen` ("Select"), `quantitiesTitle`, `instantHelp`, `requestHelp`, `walkinsHelp`, `Fleet.model.readyNow` (now "Walk-ins"), `Fleet.model.deleteBlocked` and `FormErrors.productHasVehicles` (the same sentence), `Fleet.model.removeTitle`. Gone: `Fleet.model.modesHelp`, `retire`, `retireConfirm`, `Fleet.motoMangos.bikesOnly`, `Products.open`.

| Key | English | Thai |
| --- | --- | --- |
| `Nav.products` | Products | สินค้า |
| `Products.title` | Products | สินค้า |
| `Products.intro` | {count, plural, =0 {No products yet} one {# product} other {# products}}: what you rent out. Each vehicle you own sits under its product. | {count, plural, =0 {ยังไม่มีสินค้า} other {สินค้า # รายการ}}: สิ่งที่ร้านให้เช่า รถแต่ละคันของร้านอยู่ภายใต้สินค้าของมัน |
| `Products.new` | New product | สินค้าใหม่ |
| `Products.empty` | Nothing here yet. Start with “New product”, then add your vehicles to it, or import them all from a CSV file on the Fleet page. | ยังไม่มีสินค้า เริ่มที่ “สินค้าใหม่” แล้วเพิ่มรถของร้านไว้ใต้สินค้านั้น หรือนำเข้าทั้งหมดจากไฟล์ CSV ที่หน้ารถทั้งหมด |
| `Products.searchLabel` | Find a product | ค้นหาสินค้า |
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
| `Products.history.field.categories` | Categories | หมวดหมู่ |
| `Products.history.field.deposit` | Deposit (minor units) | เงินมัดจำ (หน่วยย่อย) |
| `Products.history.field.bookable_online` | Can be booked online | จองออนไลน์ได้ |
| `Products.history.field.marketplace_listed` | Listed on Moto Mangos | ลงประกาศบน Moto Mangos |
| `Products.history.field.instant_units` | Instant units | จำนวนคันที่ยืนยันทันที |
| `Products.history.field.request_units` | Request units | จำนวนคันที่ต้องขออนุมัติ |
| `Products.history.field.ready_now` | Ready for walk-ins | พร้อมสำหรับลูกค้าหน้าร้าน |
| `Products.history.field.retired_at` | Retired | ปลดระวาง |
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
| `Fleet.model.newTitle` | New product | สินค้าใหม่ |
| `Fleet.model.editTitle` | Product | สินค้า |
| `Fleet.model.units` | Vehicles of this product | รถของสินค้านี้ |
| `Fleet.model.delete` | Delete product | ลบสินค้า |
| `Fleet.model.deleteConfirm` | Delete this product? This can't be undone. | ลบสินค้านี้หรือไม่? ไม่สามารถย้อนกลับได้ |
| `Fleet.model.newIntro` | Something you rent out, like a Honda Click 160. Add the vehicles themselves afterwards, on the product's Units tab. | สิ่งที่ร้านให้เช่า เช่น Honda Click 160 จากนั้นเพิ่มรถแต่ละคันที่แท็บรถของสินค้านี้ |
| `Fleet.model.saveNew` | Save product | บันทึกสินค้า |
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
| `FormErrors.model_retired` | This product is retired. Restore it first. | สินค้านี้ปลดระวางแล้ว กรุณานำกลับมาใช้ก่อน |
| `FormErrors.model_has_active_units` | Retire or sell its vehicles first. A product can be retired once none of its vehicles is in the fleet. | ปลดระวางหรือขายรถของสินค้านี้ก่อน สินค้าจะปลดระวางได้เมื่อไม่มีรถคันใดอยู่ในฟลีตแล้ว |
| `FormErrors.ownModelExists` | You already have a product with this make and model. | ร้านมีสินค้ายี่ห้อและรุ่นนี้อยู่แล้ว |
| `Fleet.view.group.model` | Product | สินค้า |
| `Fleet.bands.intro` | How the Fleet list splits this product by model year. With none, it shows one group for all years. | วิธีที่หน้ารถทั้งหมดแบ่งสินค้านี้ตามปีของรุ่น หากไม่มี จะแสดงกลุ่มเดียวสำหรับทุกปี |
| `Fleet.what.kindLegend` | What kind of product is it? | สินค้านี้เป็นประเภทใด |
| `Fleet.category.dirt_bike` | Dirt bike | รถวิบาก |
| `Fleet.model.detailsTitle` | Product details | รายละเอียดสินค้า |
| `Fleet.model.name` | Product name | ชื่อสินค้า |
| `Fleet.motoMangos.categoryFirst` | Choose a category for this product on the Details tab, save, and then you can send it to Moto Mangos. | เลือกหมวดหมู่ของสินค้านี้ที่แท็บรายละเอียด บันทึก แล้วจึงส่งให้ Moto Mangos ได้ |
| `Fleet.list` | Vehicles by product | รถตามสินค้า |
| `Fleet.vehicleCounts` | {vehicles, plural, =0 {No vehicles} one {# vehicle} other {# vehicles}} · {available} available | {vehicles, plural, =0 {ไม่มีรถ} other {รถ # คัน}} · พร้อมใช้ {available} คัน |
| `Fleet.searchPlaceholder` | Product name, plate or frame number | ชื่อสินค้า ทะเบียน หรือเลขตัวถัง |
| `Fleet.unit.modelYear` | Year | ปี |
| `Fleet.unit.modelYearHelp` | The year of this vehicle. | ปีของรถคันนี้ |
| `Fleet.model.namePlaceholder` | e.g. Honda CB500X 2022-2024 | เช่น Honda CB500X 2022-2024 |
| `Fleet.model.nameHelp` | What you call it. Put the make, model and years in the name if you want them. No two products can have the same name. | ชื่อที่ร้านใช้เรียก ใส่ยี่ห้อ รุ่น และปีไว้ในชื่อได้หากต้องการ สินค้าสองรายการใช้ชื่อเดียวกันไม่ได้ |
| `Fleet.model.bufferBefore` | Buffer before pickup (hours) | เวลาเผื่อก่อนรับรถ (ชั่วโมง) |
| `Fleet.model.bufferAfter` | Buffer after return (hours) | เวลาเผื่อหลังคืนรถ (ชั่วโมง) |
| `Fleet.model.bufferHelp` | Decimals are fine: 0.5 is half an hour. Blank uses the shop default (set in Phase 2). | ใส่ทศนิยมได้ เช่น 0.5 คือครึ่งชั่วโมง เว้นว่างเพื่อใช้ค่าเริ่มต้นของร้าน (ตั้งค่าในเฟส 2) |
| `Products.duplicate` | Duplicate | ทำสำเนา |
| `Products.searchPlaceholder` | Product name | ชื่อสินค้า |
| `FormErrors.invalidHours` | Enter the hours as a number, like 2 or 0.5 (168 at most). | กรอกจำนวนชั่วโมงเป็นตัวเลข เช่น 2 หรือ 0.5 (ไม่เกิน 168) |
| `FormErrors.specs_required` | Give the make, model, engine size, transmission and year first. | กรุณาระบุยี่ห้อ รุ่น ขนาดเครื่องยนต์ ระบบเกียร์ และปีก่อน |
| `Fleet.motoMangos.selectFromList` | Select your make and model from the list | เลือกยี่ห้อและรุ่นของคุณจากรายการ |
| `Fleet.motoMangos.notInList` | Don’t see your bike above? Send us the details and we’ll get it added | ไม่เห็นรถของคุณด้านบน? ส่งรายละเอียดมาให้เรา แล้วเราจะเพิ่มให้ |
| `Fleet.motoMangos.submitHelp` | Give its make, model, engine size, transmission and year: all five are needed. We review it first because it is new to our list. | ระบุยี่ห้อ รุ่น ขนาดเครื่องยนต์ ระบบเกียร์ และปี ต้องมีครบทั้งห้าอย่าง เราจะตรวจก่อนเพราะยังไม่อยู่ในรายการของเรา |
| `Fleet.motoMangos.submit` | Send for review | ส่งให้ตรวจ |
| `Fleet.motoMangos.bikeYear` | Year of your bike | ปีของรถคุณ |
| `Fleet.motoMangos.bikeYearHelp` | One year, like 2023. | ปีเดียว เช่น 2023 |
| `Fleet.motoMangos.listingTitle` | Listing | การลงประกาศ |
| `Fleet.motoMangos.listingLocked` | You can switch this on once a model is selected from the list above, or your request is approved. | เปิดใช้ได้เมื่อเลือกรุ่นจากรายการด้านบนแล้ว หรือเมื่อคำขอของคุณได้รับอนุมัติ |
| `Fleet.motoMangos.list` | List this product on Moto Mangos | ลงประกาศสินค้านี้บน Moto Mangos |
| `Fleet.what.tip.text` | To put this vehicle on the Moto Mangos marketplace, save it first. Then, on its product page, select its make and model from the Moto Mangos list or send us its details. | หากต้องการลงรถคันนี้ในตลาด Moto Mangos ให้บันทึกก่อน จากนั้นที่หน้าสินค้า ให้เลือกยี่ห้อและรุ่นจากรายการของ Moto Mangos หรือส่งรายละเอียดมาให้เรา |
| `Fleet.import.columnsHelp` | “product” is required: the product’s name, as it is on your Products page. A name you don’t have yet creates the product: give “vehicle_type” (motorbike, car, atv, boat or other; blank means motorbike) and “category” (the choices are under Categories below; required for a motorbike or a car; for several, separate them with a semicolon, like “adventure; touring”). There is no make, model, engine size or transmission column: put the make, model and years in the product’s name or description if you want them. “year” is the vehicle’s own year. Leave “plate” blank for a vehicle without one yet. Dates are YYYY-MM-DD; odometer is in {unit}; purchase price is in {currency}. | ต้องมี “product”: ชื่อสินค้าตามที่อยู่ในหน้าสินค้าของร้าน ชื่อที่ร้านยังไม่มีจะสร้างสินค้าใหม่: ระบุ “vehicle_type” (motorbike, car, atv, boat หรือ other เว้นว่างหมายถึง motorbike) และ “category” (ตัวเลือกอยู่ใต้หัวข้อ หมวด ด้านล่าง บังคับสำหรับมอเตอร์ไซค์และรถยนต์ หากมีหลายหมวดให้คั่นด้วยเครื่องหมาย ; เช่น “adventure; touring”) ไม่มีคอลัมน์ยี่ห้อ รุ่น ขนาดเครื่องยนต์ หรือระบบเกียร์: ใส่ยี่ห้อ รุ่น และปีไว้ในชื่อหรือคำอธิบายของสินค้าได้หากต้องการ “year” คือปีของรถคันนั้น เว้น “plate” ว่างสำหรับรถที่ยังไม่มีทะเบียน วันที่เป็น YYYY-MM-DD เลขไมล์เป็น {unit} ราคาซื้อเป็น {currency} |
| `Admin.years` | Model years this entry covers | ปีรุ่นที่รายการนี้ครอบคลุม |
| `Admin.yearFrom` | First model year | ปีรุ่นแรก |
| `Admin.yearTo` | Last model year | ปีรุ่นสุดท้าย |
| `Admin.yearsHelp` | The shop’s own bike is a {year}. Set the range of years before you approve. | รถของร้านเป็นปี {year} กำหนดช่วงปีก่อนอนุมัติ |
| `Fleet.editModel` | Edit product | แก้ไขสินค้า |
| `Fleet.motoMangos.useChosen` | Select | เลือก |
| `Fleet.motoMangos.quantitiesTitle` | Set bike quantities per booking type | กำหนดจำนวนรถตามประเภทการจอง |
| `Fleet.motoMangos.instantHelp` | Future bookings that receive instant approval | การจองล่วงหน้าที่ได้รับการอนุมัติทันที |
| `Fleet.motoMangos.requestHelp` | Future bookings that require your approval | การจองล่วงหน้าที่ต้องรอร้านอนุมัติ |
| `Fleet.motoMangos.walkinsHelp` | Bookings that are ready for immediate pickup today (overrides the booking buffer) | การจองที่พร้อมรับรถได้ทันทีในวันนี้ (ไม่ใช้เวลาเผื่อของการจอง) |
| `Fleet.model.readyNow` | Walk-ins | ลูกค้าหน้าร้าน |
| `Fleet.model.deleteBlocked` | This product still has vehicles. Remove all its vehicles first. | สินค้านี้ยังมีรถอยู่ กรุณานำรถทั้งหมดออกก่อน |
| `FormErrors.productHasVehicles` | This product still has vehicles. Remove all its vehicles first. | สินค้านี้ยังมีรถอยู่ กรุณานำรถทั้งหมดออกก่อน |
| `Fleet.model.removeTitle` | Delete this product | ลบสินค้านี้ |

## Stage B: general products (13 Nov 2026)

New Thai texts on the branch `platform/products-stage-b`: the two-choice start of "New product", the General form, the list tabs, the Stock tab, the manual order, "Change model" and "Disconnect", and their error messages. Claude's translations again, for the same native check. One existing line changed: `Products.type.service` was "Service" (บริการ) and is now "Service or extra" (บริการหรือบริการเสริม).

Words to look at first, because many lines use them:

| English | Thai used | Note |
| --- | --- | --- |
| General (the tab and the choice) | ทั่วไป | Everything that is not a vehicle |
| unit, of gear | ชิ้น | A vehicle stays คัน |
| in stock | มีในสต็อก | |
| damaged | ชำรุด | Out of use for cleaning or repair |
| lost | สูญหาย | |
| label, on a unit | ป้ายชื่อ | "GoPro 3" |
| Disconnect (from Moto Mangos) | ยกเลิกการเชื่อมต่อ | |
| Change model | เปลี่ยนรุ่น | |

| Key | English | Thai |
| --- | --- | --- |
| `Products.tab.label` | Which products | กลุ่มสินค้า |
| `Products.tab.all` | All | ทั้งหมด |
| `Products.tab.vehicles` | Vehicles | ยานพาหนะ |
| `Products.tab.general` | General | ทั่วไป |
| `Products.type.service` | Service or extra | บริการหรือบริการเสริม |
| `Products.inStock` | {inStock} in stock | มีในสต็อก {inStock} |
| `Products.inStockLost` | {inStock} in stock, {lost} lost | มีในสต็อก {inStock} สูญหาย {lost} |
| `Products.noStock` | No stock: it is a service | ไม่มีสต็อก: เป็นบริการ |
| `Products.addedGeneral` | Product saved. | บันทึกสินค้าแล้ว |
| `Products.delete` | Delete product | ลบสินค้า |
| `Products.deleteTitle` | Delete this product | ลบสินค้านี้ |
| `Products.deleteConfirm` | Delete this product? This can't be undone. | ลบสินค้านี้หรือไม่? ไม่สามารถย้อนกลับได้ |
| `Products.deleteBlocked` | This product still has stock. Set its quantity to 0 and remove any lost units first. | สินค้านี้ยังมีสต็อกอยู่ กรุณาตั้งจำนวนเป็น 0 และนำชิ้นที่สูญหายออกก่อน |
| `Products.tabs.stock` | Stock | สต็อก |
| `Products.order.up` | Move up | เลื่อนขึ้น |
| `Products.order.down` | Move down | เลื่อนลง |
| `Products.order.reset` | Reset to A–Z | รีเซ็ตเป็น A–Z |
| `Products.order.resetConfirm` | Reset to A–Z? Your own order of products is cleared, on Fleet and on the Products list. | รีเซ็ตเป็น A–Z หรือไม่? ลำดับสินค้าที่ร้านจัดไว้จะถูกล้าง ทั้งในหน้ารถทั้งหมดและหน้าสินค้า |
| `Products.order.custom` | Shown in your own order. | แสดงตามลำดับที่ร้านจัดไว้ |
| `Products.order.filtered` | Clear the search and filters to change the order. | ล้างคำค้นหาและตัวกรองก่อน จึงจะเปลี่ยนลำดับได้ |
| `Products.choice.legend` | What are you adding? | คุณกำลังเพิ่มอะไร? |
| `Products.choice.vehicle` | Vehicle | ยานพาหนะ |
| `Products.choice.vehicleHelp` | A motorbike, car, boat or anything else with its own plate and records. | มอเตอร์ไซค์ รถยนต์ เรือ หรือสิ่งอื่นที่มีทะเบียนและประวัติของตัวเอง |
| `Products.choice.general` | General | ทั่วไป |
| `Products.choice.generalHelp` | Rental gear, items for sale, services and extras. | อุปกรณ์ให้เช่า สินค้าสำหรับขาย บริการและบริการเสริม |
| `Products.general.typeLegend` | What type of product is it? | สินค้านี้เป็นประเภทใด? |
| `Products.general.typeHelp.gear` | Lent out and returned: helmets, cameras, phone holders. | ให้ยืมแล้วรับคืน: หมวกกันน็อก กล้อง ที่ยึดโทรศัพท์ |
| `Products.general.typeHelp.sale_item` | Sold, not returned: stickers, shirts, hats. | ขายขาด ไม่รับคืน: สติกเกอร์ เสื้อ หมวก |
| `Products.general.typeHelp.service` | Charged for, with no stock: cover, delivery, licence help. | คิดค่าบริการ ไม่มีสต็อก: ความคุ้มครอง การส่งรถ การช่วยเรื่องใบขับขี่ |
| `Products.general.name` | Product name | ชื่อสินค้า |
| `Products.general.nameHelp` | One product per size for now: add Helmet S, Helmet M and Helmet L as three products. | ตอนนี้ใช้หนึ่งสินค้าต่อหนึ่งขนาด: เพิ่มหมวก S หมวก M และหมวก L เป็นสามสินค้า |
| `Products.general.namePlaceholder` | e.g. Helmet M | เช่น หมวกกันน็อก M |
| `Products.general.description` | Description | คำอธิบาย |
| `Products.general.trackUnits` | Track each unit on its own | ติดตามแยกทีละชิ้น |
| `Products.general.trackUnitsHelp` | Each unit gets its own line, and a label if you want one. Leave it off to count them only. | แต่ละชิ้นมีบรรทัดของตัวเอง และตั้งป้ายชื่อได้หากต้องการ ไม่ต้องเลือกหากต้องการนับจำนวนอย่างเดียว |
| `Products.general.quantity` | Quantity | จำนวน |
| `Products.general.quantityAt` | Quantity at {location} | จำนวนที่ {location} |
| `Products.general.quantityHelp` | How many you have. You can change it later on the Stock tab. | จำนวนที่ร้านมี เปลี่ยนได้ภายหลังที่แท็บสต็อก |
| `Products.general.serviceNote` | A service has no quantity: it is always available. | บริการไม่มีจำนวน: พร้อมให้บริการเสมอ |
| `Products.general.pricesLater` | Prices come in a later stage, and selling items comes with orders. | ราคาจะมาในขั้นถัดไป และการขายสินค้าจะมาพร้อมระบบออเดอร์ |
| `Products.general.save` | Add product | เพิ่มสินค้า |
| `Products.stockTab.counts` | Stock at this location | สต็อกที่สาขานี้ |
| `Products.stockTab.inStock` | {count} in stock | มีในสต็อก {count} |
| `Products.stockTab.available` | {count} available now | พร้อมใช้ตอนนี้ {count} |
| `Products.stockTab.damaged` | {count} damaged | ชำรุด {count} |
| `Products.stockTab.lost` | {count} lost | สูญหาย {count} |
| `Products.stockTab.onHand` | {count} on hand | มีอยู่ {count} |
| `Products.stockTab.quantity` | Quantity | จำนวน |
| `Products.stockTab.quantityHelpGear` | Raising it adds units. Lowering it removes units that are free. | เพิ่มจำนวนคือเพิ่มชิ้น ลดจำนวนคือนำชิ้นที่ว่างออก |
| `Products.stockTab.quantityHelpSale` | What you have on hand now. The change is kept in the stock history. | จำนวนที่มีอยู่ตอนนี้ การเปลี่ยนแปลงจะถูกเก็บไว้ในประวัติสต็อก |
| `Products.stockTab.changeQuantity` | Change quantity | เปลี่ยนจำนวน |
| `Products.stockTab.markDamaged` | Mark damaged | ทำเครื่องหมายว่าชำรุด |
| `Products.stockTab.damagedHowMany` | How many are damaged | ชำรุดกี่ชิ้น |
| `Products.stockTab.until` | Back in use on (optional) | กลับมาใช้ได้เมื่อ (ไม่บังคับ) |
| `Products.stockTab.untilHelp` | Leave blank if you don’t know yet. Time zone: {zone}. | เว้นว่างได้หากยังไม่ทราบ เขตเวลา: {zone} |
| `Products.stockTab.backInUse` | Back in use | กลับมาใช้ได้ |
| `Products.stockTab.repairedHowMany` | How many are back in use | กลับมาใช้ได้กี่ชิ้น |
| `Products.stockTab.markLost` | Mark lost | ทำเครื่องหมายว่าสูญหาย |
| `Products.stockTab.lostHowMany` | How many are lost | สูญหายกี่ชิ้น |
| `Products.stockTab.lostConfirm` | Mark as lost? It leaves your stock now. An owner or manager can bring it back or remove it. | ทำเครื่องหมายว่าสูญหายหรือไม่? จะออกจากสต็อกทันที เจ้าของหรือผู้จัดการนำกลับมาหรือนำออกได้ |
| `Products.stockTab.lostTitle` | Lost units | ชิ้นที่สูญหาย |
| `Products.stockTab.lostHelp` | Found again: put them back in stock. Gone for good: remove them, which lowers your quantity. | หากพบแล้ว: นำกลับเข้าสต็อก หากหายถาวร: นำออก ซึ่งจะลดจำนวนของร้าน |
| `Products.stockTab.lostWaiting` | An owner or manager decides what happens to lost units. | เจ้าของหรือผู้จัดการเป็นผู้ตัดสินใจเรื่องชิ้นที่สูญหาย |
| `Products.stockTab.restore` | Back in stock | นำกลับเข้าสต็อก |
| `Products.stockTab.restoreHowMany` | How many were found | พบแล้วกี่ชิ้น |
| `Products.stockTab.remove` | Remove for good | นำออกถาวร |
| `Products.stockTab.removeHowMany` | How many are gone for good | หายถาวรกี่ชิ้น |
| `Products.stockTab.removeConfirm` | Remove for good? This lowers your quantity and can’t be undone. | นำออกถาวรหรือไม่? จำนวนของร้านจะลดลงและไม่สามารถย้อนกลับได้ |
| `Products.stockTab.units` | Units | รายชิ้น |
| `Products.stockTab.unit` | Unit {number} | ชิ้นที่ {number} |
| `Products.stockTab.noUnits` | No units here yet. Set the quantity to add some. | ยังไม่มีชิ้นที่นี่ ตั้งจำนวนเพื่อเพิ่ม |
| `Products.stockTab.label` | Label (optional) | ป้ายชื่อ (ไม่บังคับ) |
| `Products.stockTab.labelPlaceholder` | e.g. GoPro 3 | เช่น GoPro 3 |
| `Products.stockTab.saveLabel` | Save label | บันทึกป้ายชื่อ |
| `Products.stockTab.status.available` | Available | พร้อมใช้ |
| `Products.stockTab.status.damaged` | Damaged | ชำรุด |
| `Products.stockTab.status.lost` | Lost | สูญหาย |
| `Products.stockTab.ledger` | Stock history | ประวัติสต็อก |
| `Products.stockTab.ledgerIntro` | Every change to what is on hand, newest first. | ทุกการเปลี่ยนแปลงของจำนวนที่มีอยู่ เรียงจากล่าสุด |
| `Products.stockTab.ledgerNone` | No stock recorded yet. | ยังไม่มีการบันทึกสต็อก |
| `Products.stockTab.kind.received` | Received | รับเข้า |
| `Products.stockTab.kind.adjusted` | Adjusted | ปรับยอด |
| `Products.stockTab.kind.sold` | Sold | ขาย |
| `Products.stockTab.kind.returned` | Returned | รับคืน |
| `Products.stockTab.serviceNote` | A service has no stock: it is always available. | บริการไม่มีสต็อก: พร้อมให้บริการเสมอ |
| `Products.history.introGeneral` | Who changed what on this product, newest first. | ใครเปลี่ยนอะไรในสินค้านี้ เรียงจากล่าสุด |
| `Products.history.unlabelled` | without a label | ไม่มีป้ายชื่อ |
| `Products.history.on.gearUnits` | unit {name} | ชิ้น {name} |
| `Products.history.action.stock_adjust` | {who} changed the quantity of {what} | {who} เปลี่ยนจำนวนของ{what} |
| `Products.history.action.units_damaged` | {who} marked {count} damaged on {what} | {who} ทำเครื่องหมายว่าชำรุด {count} ชิ้นใน{what} |
| `Products.history.action.units_repaired` | {who} put {count} back in use on {what} | {who} นำ {count} ชิ้นกลับมาใช้ใน{what} |
| `Products.history.action.units_lost` | {who} marked {count} lost on {what} | {who} ทำเครื่องหมายว่าสูญหาย {count} ชิ้นใน{what} |
| `Products.history.action.lost_restored` | {who} put {count} lost back in stock on {what} | {who} นำชิ้นที่สูญหาย {count} ชิ้นกลับเข้าสต็อกใน{what} |
| `Products.history.action.lost_removed` | {who} removed {count} lost for good from {what} | {who} นำชิ้นที่สูญหาย {count} ชิ้นออกถาวรจาก{what} |
| `Products.history.action.listing_change_model` | {who} moved {what} to another Moto Mangos list entry | {who} ย้าย{what}ไปยังรายการอื่นของ Moto Mangos |
| `Products.history.action.listing_disconnect` | {who} disconnected {what} from Moto Mangos | {who} ยกเลิกการเชื่อมต่อ{what}กับ Moto Mangos |
| `Products.history.field.quantity` | Quantity | จำนวน |
| `Products.history.field.label` | Label | ป้ายชื่อ |
| `Fleet.status.lost` | Lost | สูญหาย |
| `Fleet.motoMangos.changeModel` | Change model | เปลี่ยนรุ่น |
| `Fleet.motoMangos.changeModelHelp` | Pick the make and model this product should be listed as. Your listing and its quantities stay as they are. | เลือกยี่ห้อและรุ่นที่ต้องการให้สินค้านี้ลงประกาศ การลงประกาศและจำนวนของคุณยังคงเดิม |
| `Fleet.motoMangos.changeModelLegend` | Select the new make and model | เลือกยี่ห้อและรุ่นใหม่ |
| `Fleet.motoMangos.disconnect` | Disconnect | ยกเลิกการเชื่อมต่อ |
| `Fleet.motoMangos.disconnectHelp` | Takes this product off Moto Mangos: the listing is switched off and its place on the list is cleared. | นำสินค้านี้ออกจาก Moto Mangos: ปิดการลงประกาศและล้างรายการที่เชื่อมไว้ |
| `Fleet.motoMangos.disconnectConfirm` | Disconnect this product from Moto Mangos? Its listing is switched off and its list entry is cleared. Bookings already made stay as they are. | ยกเลิกการเชื่อมต่อสินค้านี้กับ Moto Mangos หรือไม่? การลงประกาศจะถูกปิดและรายการที่เชื่อมไว้จะถูกล้าง การจองที่มีอยู่แล้วยังคงเดิม |
| `Fleet.motoMangos.upcomingBookings` | {count, plural, one {# upcoming booking on this product’s vehicles stays} other {# upcoming bookings on this product’s vehicles stay}} exactly as booked if you change the model or disconnect. | {count, plural, other {การจองที่กำลังจะมาถึง # รายการของรถในสินค้านี้}}จะยังคงเดิมทุกอย่าง แม้คุณเปลี่ยนรุ่นหรือยกเลิกการเชื่อมต่อ |
| `FormErrors.invalidQuantity` | Enter a whole number. | กรอกจำนวนเต็ม |
| `FormErrors.units_blocked` | {count, plural, one {# unit is} other {# units are}} damaged or booked, so the quantity can’t go below {count}. | {count, plural, other {มี # ชิ้น}}ที่ชำรุดหรือถูกจองอยู่ จึงลดจำนวนให้ต่ำกว่า {count} ไม่ได้ |
| `FormErrors.notEnoughToLose` | Only {count} can be marked lost: the rest are booked. | ทำเครื่องหมายว่าสูญหายได้เพียง {count} ชิ้น ที่เหลือถูกจองอยู่ |
| `FormErrors.not_enough_free` | Only {count} are free to mark damaged. | มีเพียง {count} ชิ้นที่ว่างให้ทำเครื่องหมายว่าชำรุด |
| `FormErrors.not_enough_damaged` | Only {count} are damaged. | มีชำรุดเพียง {count} ชิ้น |
| `FormErrors.not_enough_lost` | Only {count} are lost. | มีสูญหายเพียง {count} ชิ้น |
| `FormErrors.quantity_out_of_range` | Enter a quantity from 0 to 1,000 (up to 100,000 for an item for sale). | กรอกจำนวนตั้งแต่ 0 ถึง 1,000 (สินค้าสำหรับขายได้ถึง 100,000) |
| `FormErrors.until_in_past` | Choose a time in the future. | เลือกเวลาในอนาคต |
| `FormErrors.label_needs_tracking` | Switch on “Track each unit on its own” first. | เปิด “ติดตามแยกทีละชิ้น” ก่อน |
| `FormErrors.tracked_units_have_records` | These units have purchase details, so they stay tracked one by one. | ชิ้นเหล่านี้มีข้อมูลการซื้อ จึงต้องติดตามแยกทีละชิ้นต่อไป |
| `FormErrors.stock_below_zero` | Stock can’t go below zero. | สต็อกต่ำกว่าศูนย์ไม่ได้ |
| `FormErrors.productHasStock` | This product still has stock. Set its quantity to 0 and remove any lost units first. | สินค้านี้ยังมีสต็อกอยู่ กรุณาตั้งจำนวนเป็น 0 และนำชิ้นที่สูญหายออกก่อน |
| `FormErrors.product_has_stock` | This product still has stock. Set its quantity to 0 and remove any lost units first. | สินค้านี้ยังมีสต็อกอยู่ กรุณาตั้งจำนวนเป็น 0 และนำชิ้นที่สูญหายออกก่อน |
| `FormErrors.labelExists` | Another unit of this product already has that label. | มีชิ้นอื่นของสินค้านี้ใช้ป้ายชื่อนี้แล้ว |
| `FormErrors.not_on_list` | This product isn’t on the Moto Mangos list. | สินค้านี้ไม่ได้อยู่ในรายการของ Moto Mangos |
| `FormErrors.same_model` | It is already on that one. Choose a different one. | สินค้านี้ใช้รายการนั้นอยู่แล้ว กรุณาเลือกรายการอื่น |
| `FormErrors.request_pending` | Its request is still waiting for review. | คำขอยังรอการตรวจอยู่ |
