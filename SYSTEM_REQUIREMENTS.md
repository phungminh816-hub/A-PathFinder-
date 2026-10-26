# Yêu cầu hệ thống

- **Node.js:** phiên bản 18 trở lên.
- **Trình duyệt:** Chrome, Edge, Firefox hoặc Safari có hỗ trợ ES2020, Canvas và `fetch`.
- **Bộ nhớ:** khuyến nghị tối thiểu 512 MB trống để phân tích file đồ thị OSM khoảng 10 MB.
- **Mạng:** cần kết nối để tải Leaflet, tile nền OpenStreetMap và tìm địa chỉ qua Nominatim. Thuật toán và file đồ thị chạy cục bộ.
- **Cổng mặc định:** TCP `8000` trên `127.0.0.1`; có thể đổi bằng `.env`.

Không cần Python, cơ sở dữ liệu hay `npm install` vì server chỉ dùng module có sẵn của Node.js.
