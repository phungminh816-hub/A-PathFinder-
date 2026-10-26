# A* Map Pathfinder

Ứng dụng web tối giản để chọn hai điểm trên bản đồ Hà Nội và tìm đường trên đồ thị OpenStreetMap cục bộ. Dự án chỉ giữ phần bản đồ, nhập điểm, thuật toán **Bidirectional A\***, trực quan hóa quá trình duyệt và thống kê kết quả; không còn landing page hay dashboard trang trí.

## Thành phần lõi

| Thành phần | Vai trò |
|---|---|
| `My_Map/map_data.json` | Dữ liệu node/way OpenStreetMap cục bộ, được chuyển thành danh sách kề khi trang tải. |
| `My_Map/script.js` | Đọc đồ thị, tìm đỉnh gần nhất, chạy Bidirectional A\*, dựng tuyến và tính thống kê. |
| `My_Map/index.html` | Một màn hình duy nhất gồm bản đồ và bảng điều khiển nhỏ. |
| `My_Map/style.css` | Bố cục toàn màn hình, không dùng framework CSS hoặc font ngoài. |
| `server.js` | Static server Node.js, đọc `.env` và phát cấu hình runtime tại `/config.js`. |

## Tìm kiếm và tìm đường hoạt động như thế nào

### 1. Chọn vị trí

- **Tìm theo địa chỉ:** hai ô điểm đầu/điểm cuối gọi Nominatim. Truy vấn được debounce mặc định 1 giây, giới hạn trong bounding box đã cấu hình và chỉ lấy tối đa 5 kết quả.
- **Chọn trực tiếp:** lần bấm thứ nhất trên bản đồ đặt điểm đầu, lần thứ hai đặt điểm cuối. Cách này vẫn hoạt động khi tắt geocoding.
- **Ghép vào đồ thị:** tọa độ người dùng được ánh xạ tới node OSM gần nhất bằng khoảng cách tọa độ bình phương.

### 2. Thuật toán tìm đường

Ứng dụng chạy **Bidirectional A\***: một nhánh tìm từ điểm đầu trên đồ thị thuận, nhánh còn lại tìm từ điểm cuối trên đồ thị chuyển vị. Hàng đợi ưu tiên dùng binary min-heap; heuristic là khoảng cách phẳng xấp xỉ theo vĩ độ/kinh độ tại Hà Nội. Thuật toán dừng khi hai phía gặp nhau hoặc cận tốt nhất không còn khả năng cải thiện.

Ba tiêu chí có sẵn:

- **Ngắn nhất:** chi phí cạnh là khoảng cách Haversine theo mét.
- **Theo trọng số giao thông:** chi phí là khoảng cách nhân hệ số `1`, `2.5` hoặc `5`. Đây là dữ liệu mô phỏng xác định theo OSM way ID, **không phải giao thông thời gian thực**.
- **Chỉ đường sắt:** chỉ duyệt cạnh có tag `railway`; có thể không tìm được tuyến nếu hai điểm không cùng thành phần liên thông đường sắt.

Chế độ hiển thị `Tức thời`, `Nhanh`, `Từng bước` chỉ thay đổi tốc độ vẽ các node đã duyệt, không thay đổi tiêu chí tuyến.

## Bản đồ dùng thư viện gì

- **Leaflet 1.9.4** hiển thị tile, marker, bounding box, đồ thị và polyline kết quả.
- **OpenStreetMap** cung cấp tile nền mặc định và dữ liệu đồ thị trong `map_data.json`.
- **Leaflet Canvas renderer** gom các đoạn đường theo nhóm trọng số để giảm số lượng DOM layer.
- **Canvas overlay tự viết** vẽ frontier/node đã duyệt của hai hướng A\*.
- **Nominatim** chỉ phục vụ autocomplete địa chỉ; tìm đường luôn chạy trong trình duyệt trên dữ liệu cục bộ.

Leaflet và tile nền được tải qua mạng. Thuật toán vẫn là mã cục bộ, nhưng muốn chạy hoàn toàn offline cần lưu Leaflet và một nguồn tile nội bộ rồi đổi cấu hình tương ứng.

## Yêu cầu hệ thống

- Node.js **18 trở lên**.
- Trình duyệt hiện đại có `fetch`, Canvas và ES2020.
- Kết nối mạng nếu dùng CDN Leaflet, tile OpenStreetMap hoặc Nominatim.

Không cần Python, database hay `npm install`; `requirements.txt` được giữ để xác nhận không có dependency Python. Chi tiết nằm trong [SYSTEM_REQUIREMENTS.md](SYSTEM_REQUIREMENTS.md).

## Chạy dự án

### Windows PowerShell

```powershell
.\scripts\start.ps1
```

Script tự sao chép `.env.example` thành `.env` nếu chưa có, sau đó chạy server. Nếu Execution Policy chặn script, dùng cách thủ công:

```powershell
Copy-Item .env.example .env
node server.js
```

### macOS/Linux

```sh
sh scripts/start.sh
```

### Chạy trực tiếp

```sh
npm start
```

Mở `http://127.0.0.1:8000`. Không mở trực tiếp `index.html` bằng `file://` vì trình duyệt sẽ chặn việc tải `map_data.json` và không có cấu hình runtime từ `.env`.

Kiểm tra cú pháp trước khi chạy:

```sh
npm run check
```

## Cấu hình `.env`

Không commit `.env`; chỉ commit `.env.example`. Biến môi trường của hệ điều hành được ưu tiên hơn giá trị trong file.

| Biến | Mặc định | Ý nghĩa |
|---|---:|---|
| `APP_HOST` | `127.0.0.1` | Interface mà static server lắng nghe. |
| `APP_PORT` | `8000` | Cổng HTTP. |
| `MAP_CENTER_LAT`, `MAP_CENTER_LON` | `21.028`, `105.830` | Tâm bản đồ ban đầu. |
| `MAP_DEFAULT_ZOOM`, `MAP_MAX_ZOOM` | `12`, `19` | Mức zoom ban đầu/tối đa. |
| `MAP_MIN_LAT`, `MAP_MAX_LAT` | `20.980`, `21.075` | Biên vĩ độ của vùng định tuyến. |
| `MAP_MIN_LON`, `MAP_MAX_LON` | `105.770`, `105.890` | Biên kinh độ của vùng định tuyến. |
| `MAP_DATA_URL` | `map_data.json` | URL dữ liệu OSM tương đối với thư mục `My_Map`. |
| `MAP_TILE_URL` | OpenStreetMap Standard | Mẫu URL tile Leaflet. |
| `MAP_TILE_ATTRIBUTION` | OpenStreetMap contributors | Attribution hiển thị trên bản đồ. |
| `GEOCODING_ENABLED` | `true` | `false` để tắt tìm địa chỉ và chỉ chọn bằng click. |
| `GEOCODING_URL` | Nominatim public | Endpoint autocomplete. |
| `GEOCODING_LIMIT` | `5` | Số gợi ý tối đa. |
| `GEOCODING_LANGUAGE` | `vi` | Ngôn ngữ ưu tiên cho kết quả. |
| `GEOCODING_DEBOUNCE_MS` | `1000` | Thời gian chờ trước khi gửi truy vấn. |

Nếu thay `map_data.json`, phải cập nhật bốn biến bounding box để click, geocoding và vùng hiển thị khớp với dữ liệu mới.

## Cấu trúc thư mục

```text
.
├── My_Map/
│   ├── index.html
│   ├── map_data.json
│   ├── script.js
│   └── style.css
├── scripts/
│   ├── start.ps1
│   └── start.sh
├── .env.example
├── package.json
├── requirements.txt
├── server.js
└── SYSTEM_REQUIREMENTS.md
```

## Sử dụng

1. Chờ trạng thái báo đồ thị đã tải.
2. Tìm địa chỉ hoặc bấm hai điểm trong khung xanh.
3. Chọn tiêu chí và tốc độ trực quan hóa.
4. Bấm **Tìm đường**; tuyến màu tím và thống kê sẽ xuất hiện.
5. Bấm **Đặt lại** để chọn tuyến khác.

## Giới hạn dữ liệu

- Đường đi chỉ chính xác trong phạm vi và thời điểm của `map_data.json`.
- Trọng số giao thông hiện là mô phỏng, không nên dùng để điều hướng thực tế.
- Tìm node gần nhất đang quét tuyến tính toàn bộ node; với dữ liệu lớn hơn đáng kể nên thay bằng spatial index như k-d tree hoặc R-tree.
