--Bài thực hành số 4
--a, Bài tập về Store Procudure
--1, In ra dòng xin chao
CREATE PROCEDURE printXinChao AS
Begin 
	PRINT 'Xin Chào';
End
GO
--2, In ra dòng xin chao với tên tham số
Create PROCEDURE print_XinChao_Param
 @ten NVARCHAR(50)
 AS
Begin
	PRINT N'Xin Chao' + @ten;
End
GO
--3,Nhập vào 2 số @s1, @s2. In ra câu ‘tổng là : @tg ‘ với @tg =@s1+@s2.
Create Procedure Tong 
	@s1 INT,
	@s2 Int
AS 
BEGIN
	declare @tg INT;
	Set @tg=@s1+@s2;
	Print N'tong la : '+ Cast(@tg AS Nvarchar(10));
END;
GO
--4, Nhập vào 2 số @s1,@s2. Xuất tổng @s1+@s2 ra tham số @tong.
--Nhập vào 2 số @s1,@s2. In ra câu ‘Số lớn nhất của @s1 và @s2 là max’
--với @s1,@s2,max là các giá trị tương ứng.
CREATE PROCEDURE TongVaMax
	@s1 INT,
	@s2 INT,
	@tg INT OUTPUT
AS
BEGIN
	SET @tg=@s1+@s2;
	DECLARE @max INT;
	SET @max=@s1-@s2;
	If @max>0
		print N'Số lớn nhất của '+Cast(@s1 as NVARCHAR(50))+N' và '+CAST(@s2 as NVARCHAR(50))+N' là '+Cast(@s1 as NVARCHAR(50));
	ELSE
	    print N'Số lớn nhất của '+Cast(@s1 as NVARCHAR(50))+N' và '+CAST(@s2 as NVARCHAR(50))+N' là '+Cast(@s2 as NVARCHAR(50));
END;
go
-- 5, Nhập vào 2 số @s1,@s2. Xuất min và max của chúng ra tham số @max.
--Cho thực thi và in giá trị của các tham số này để kiểm tra
CREATE PROCEDURE MinVaMax
	@s1 INT,
	@s2 INT,
	@max INT OUTPUT
AS
BEGIN
	DECLARE @min INT;
	IF @s1>@s2
		BEGIN
			PRINT N'Số nhỏ nhất là : '+CAST(@s2 AS NVARCHAR(50));
			SET @max=@s1;
		END;
	ELSE
		BEGIN
			PRINT N'Số nhỏ nhất là : '+CAST(@s1 AS NVARCHAR(50));
			SET @max=@s2;
		END;
END;
GO
--6, Nhập vào số nguyên @n. In ra các số từ 1 đến @n
CREATE PROC print1toN
	@n INT
AS
BEGIN
	DECLARE @out NVARCHAR(max);
	SET @out = '';
	DECLARE @i INT = 1;
	WHILE @i <= @n
		BEGIN
			set @out=@out+' '+CAST(@i as NVARCHAR(50));
			set @i=@i+1;
		END;
		print @out;
END;
go
	--Kiểm tra 6 với @n=10
EXEC print1toN @n=10;
go
--7, Nhập vào số nguyên @n. In ra tổng các số chẵn từ 1 đến @n 
CREATE PROC printSumOfEven
	@n INT
AS
BEGIN 
	DECLARE @tong INT =0, @i INT = 0;
	WHILE @i<=@n
	BEGIN
		SET @tong = @tong + @i;
		SET @i=@i+2;
	END;
	print CAST(@tong as NVARCHAR(100));
END;
go
--8. Nhập vào số nguyên @n. In ra tổng và số lượng các số chẵn từ 1 đến @n
CREATE PROC printSumOfEvenAndNumberOfEven
	@n INT,
	@tong INT OUTPUT,      
	@noe INT OUTPUT         
AS
BEGIN
	SET @tong = 0;
	SET @noe = 0;
	DECLARE @i INT = 2;    

	WHILE @i <= @n
	BEGIN
		SET @tong = @tong + @i;
		SET @noe = @noe + 1;
		SET @i = @i + 2;
	END;
END;
GO 
DECLARE @t INT, @sl INT;
EXEC printSumOfEvenAndNumberOfEven @n = 10, @tong = @t OUTPUT, @noe = @sl OUTPUT;
PRINT CAST(@t AS NVARCHAR(100));
PRINT CAST(@sl AS NVARCHAR(100));
go
-- 9. Viết store procedure tương ứng với các câu ở phần View. Sau đó cho thực hiện để kiểm tra kết quả

-- 9.1. Cho biết mã số, họ tên, ngày sinh, địa chỉ và vị trí của các cầu thủ 
-- thuộc đội bóng “SHB Đà Nẵng” có quốc tịch “Bra-xin”
CREATE PROCEDURE p9_v1
AS
BEGIN
	SELECT MACT, HOTEN, NGAYSINH, DIACHI, VITRI
	FROM CAUTHU ct, CAULACBO clb, QUOCGIA qg
	WHERE ct.MACLB = clb.MACLB AND TENCLB = N'SHB Đà Nẵng'
	AND ct.MAQG = qg.MAQG AND TENQG = N'Bra-xin'
END;
go
	--thực hiện
EXEC p9_v1;
go
-- 9.2. Cho biết kết quả (MATRAN, NGAYTD, TENSAN, TENCLB1, TENCLB2, KETQUA) các trận
-- đấu vòng 3 của mùa bóng năm 2009
CREATE PROCEDURE p9_v2
AS
BEGIN
	SELECT MATRAN, NGAYTD, svd.TENSAN, clb1.TENCLB AS [TENCLB1], clb2.TENCLB AS [TENCLB2], KETQUA
	FROM TRANDAU td, SANVD svd, CAULACBO clb1, CAULACBO clb2
	WHERE clb1.MACLB = td.MACLB1 AND clb2.MACLB = td.MACLB2
	AND svd.MASAN = td.MASAN 
	AND VONG = 3 and NAM = 2009
END;
go
	--thực hiện
EXEC p9_v2;
go
-- 9.3. Cho biết mã huấn luyện viên, họ tên, ngày sinh, địa chỉ, vai trò và tên CLB đang làm việc 
-- của các huấn luyện viên có quốc tịch “Việt Nam”
CREATE PROCEDURE p9_v3
AS
BEGIN
	SELECT hlv.MAHLV, TENHLV, NGAYSINH, DIACHI, VAITRO, TENCLB
	FROM HUANLUYENVIEN hlv, HLV_CLB, CAULACBO clb, QUOCGIA qg
	WHERE hlv.MAHLV = HLV_CLB.MAHLV
	AND HLV_CLB.MACLB = clb.MACLB
	AND hlv.MAQG = qg.MAQG AND TENQG = N'Việt Nam'
END;
go
	--thực hiện
EXEC p9_v3;
go
-- 9.4. Cho biết mã câu lạc bộ, tên câu lạc bộ, tên sân vận động, địa chỉ và số lượng cầu thủ
-- nước ngoài (có quốc tịch khác “Việt Nam”) tương ứng của các câu lạc bộ nhiều hơn 
-- 2 cầu thủ nước ngoài
CREATE PROCEDURE p9_v4
AS
BEGIN
	SELECT clb.MACLB, TENCLB, TENSAN, svd.DIACHI, COUNT(MACT) AS [Số lượng cầu thủ nước ngoài]
	FROM CAULACBO clb, SANVD svd, CAUTHU ct, QUOCGIA qg
	WHERE clb.MASAN = svd.MASAN
	AND clb.MACLB = ct.MACLB
	AND ct.MAQG = qg.MAQG
	AND TENQG <> N'Việt Nam'
	GROUP BY clb.MACLB, TENCLB, TENSAN, svd.DIACHI
	HAVING COUNT(MACT) > 2
END;
go
	--thực hiện
EXEC p9_v4;
go
-- 9.5. Cho biết tên tỉnh, số lượng cầu thủ đang thi đấu ở vị trí tiền đạo trong các câu lạc 
-- bộ thuộc địa bàn tỉnh đó quản lý
CREATE PROCEDURE p9_v5
AS
BEGIN
	SELECT TENTINH, COUNT(MACT) AS [Số lượng cầu thủ đang thi đấu ở vị trí tiền đạo]
	FROM TINH, CAULACBO clb, CAUTHU ct
	WHERE TINH.MATINH = clb.MATINH
	AND clb.MACLB = ct.MACLB
	AND VITRI = N'Tiền đạo'
	GROUP BY TENTINH
END;
go
	--thực hiện
EXEC p9_v5;
go
-- 9.6. Cho biết tên câu lạc bộ, tên tỉnh mà CLB đang đóng nằm ở vị trí cao nhất 
-- của bảng xếp hạng của vòng 3 năm 2009
CREATE PROCEDURE p9_v6
AS
BEGIN
	SELECT TOP 1 TENCLB, TENTINH
	FROM CAULACBO clb, TINH, BANGXH bxh
	WHERE bxh.MACLB = clb.MACLB
	AND clb.MATINH = TINH.MATINH
	AND VONG = 3 AND NAM = 2009
END;
go
	--thực hiện
EXEC p9_v6;
go
-- 9.7. Cho biết tên huấn luyện viên đang nắm giữ một vị trí 
-- trong 1 câu lạc bộ mà chưa có số điện thoại
CREATE PROCEDURE p9_v7
AS
BEGIN
	SELECT TENHLV
	FROM HUANLUYENVIEN hlv,HLV_CLB 
	WHERE hlv.MAHLV = HLV_CLB.MAHLV
	AND HLV_CLB.VAITRO IS NOT NULL
	AND hlv.DIENTHOAI IS NULL
END;
go
	--thực hiện
EXEC p9_v7;
go
-- 9.8. Liệt kê các huấn luyện viên thuộc quốc gia Việt Nam chưa làm công tác huấn luyện 
-- tại bất kỳ một câu lạc bộ
CREATE PROCEDURE p9_v8
AS
BEGIN
	SELECT TENHLV
	FROM HUANLUYENVIEN hlv, HLV_CLB, QUOCGIA qg
	WHERE hlv.MAHLV = HLV_CLB.MACLB
	AND hlv.MAQG = qg.MAQG
	AND qg.TENQG = N'Việt Nam'
	AND HLV_CLB.MACLB IS NULL
	AND HLV_CLB.VAITRO IS NULL
END;
go
	--thực hiện
EXEC p9_v8;
go
-- 9.9. Cho biết kết quả các trận đấu đã diễn ra (MACLB1, MACLB2, NAM, VONG, SOBANTHANG, SOBANTHUA)
CREATE PROCEDURE p9_v9
AS
BEGIN
	SELECT MACLB1, MACLB2, NAM, VONG, 
		   SUBSTRING(KETQUA, 1, CHARINDEX('-',KETQUA,1)-1) AS [Số bàn thắng của CLB1],
		   SUBSTRING(KETQUA, CHARINDEX('-',KETQUA,1)+1, LEN(KETQUA)) AS [Số bàn thua của CLB1]
	FROM TRANDAU
END;
go
	--thực hiện
EXEC p9_v9;
go
-- 9.10. Cho biết kết quả các trận đấu trên sân nhà (MACLB, NAM, VONG, SOBANTHANG, SOBANTHUA)
CREATE PROCEDURE p9_v10
AS
BEGIN
	SELECT MACLB1 AS [MA CLB], NAM, VONG,  
		   SUBSTRING(KETQUA, 1, CHARINDEX('-',KETQUA,1)-1) AS [SOBANTHANG], 
		   SUBSTRING(KETQUA, CHARINDEX('-', KETQUA,1) + 1, LEN(KETQUA)) AS [SOBANTHUA]
	FROM TRANDAU
END;
go
	--thực hiện
EXEC p9_v10;
go
-- 9.11. Cho biết kết quả các trận đấu trên sân khách (MACLB, NAM, VONG, SOBANTHANG, SOBANTHUA)
CREATE PROCEDURE p9_v11
AS
BEGIN
	SELECT MACLB2 AS [MA CLB], NAM, VONG,  
		   SUBSTRING(KETQUA, CHARINDEX('-',KETQUA,1) + 1, LEN(KETQUA)) AS [SOBANTHANG],
	       SUBSTRING(KETQUA, 1, CHARINDEX('-',KETQUA,1)-1) AS [SOBANTHUA]
	FROM TRANDAU
END;
go
	--thực hiện
EXEC p9_v11;
go
-- 9.12. Cho biết danh sách các trận đấu (NGAYTD, TENSAN, TENCLB1, TENCLB2, KETQUA) 
-- của câu lạc bộ CLB đang xếp hạng cao nhất tính đến hết vòng 3 năm 2009
CREATE PROCEDURE p9_v12
AS
BEGIN
	SELECT NGAYTD, TENSAN, clb1.TENCLB AS [TENCLB1], clb2.TENCLB AS [TENCLB2], KETQUA
	FROM TRANDAU td INNER JOIN SANVD svd ON td.MASAN = svd.MASAN
					INNER JOIN CAULACBO clb1 ON td.MACLB1 = clb1.MACLB
					INNER JOIN CAULACBO clb2 ON td.MACLB2 = clb2.MACLB
	WHERE td.MACLB1 = (SELECT TOP 1 MACLB FROM BANGXH
					   ORDER BY DIEM DESC)
	   OR td.MACLB2 = (SELECT TOP 1 MACLB FROM BANGXH
					   ORDER BY DIEM DESC)
END;
go
	--thực hiện
EXEC p9_v12;
go
-- 9.13. Cho biết danh sách các trận đấu (NGAYTD, TENSAN, TENCLB1, TENCLB2, KETQUA) 
-- của câu lạc bộ CLB có thứ hạng thấp nhất trong bảng xếp hạng vòng 3 năm 2009
CREATE PROCEDURE p9_v13
AS
BEGIN
	SELECT NGAYTD, TENSAN, clb1.TENCLB AS [TENCLB1], clb2.TENCLB AS [TENCLB2], KETQUA
	FROM TRANDAU td INNER JOIN SANVD svd ON td.MASAN = svd.MASAN
					INNER JOIN CAULACBO clb1 ON td.MACLB1 = clb1.MACLB
					INNER JOIN CAULACBO clb2 ON td.MACLB2 = clb2.MACLB
	WHERE td.MACLB1 = (SELECT TOP 1 MACLB FROM BANGXH
					   ORDER BY DIEM)
	   OR td.MACLB2 = (SELECT TOP 1 MACLB FROM BANGXH
					   ORDER BY DIEM)
END;
go
	--thực hiện
EXEC p9_V13;
go

-- 10. Ứng với mỗi bảng trong CSDL Quản lý bóng đá, bạn hãy viết 4 Stored 
-- Procedure ứng với 4 công việc Insert/Update/Delete/Select. Trong đó 
-- Stored Procedure Update và Delete lấy khóa chính làm tham số 

/* Bảng QUOCGIA */
-- QUOCGIA_INSERT
CREATE PROCEDURE p10_QUOCGIA_INSERT
	@maqg VARCHAR(5), @tenqg NVARCHAR(60)
AS
BEGIN
	INSERT INTO QUOCGIA(MAQG, TENQG)
	VALUES (@maqg, @tenqg)
END;
go
-- thực hiện
SELECT * FROM QUOCGIA;
EXEC p10_QUOCGIA_INSERT 'CHN', N'China';
SELECT * FROM QUOCGIA;
go
-- QUOCGIA_UPDATE
CREATE PROCEDURE p10_QUOCGIA_UPDATE
	@maqg VARCHAR(5), @tenqg NVARCHAR(60)
AS
BEGIN
	UPDATE QUOCGIA
	SET TENQG = @tenqg
	WHERE MAQG = @maqg
END;
-- thực hiện
SELECT * FROM QUOCGIA;
EXEC p10_QUOCGIA_UPDATE 'CHN', N'Trung Quốc';
SELECT * FROM QUOCGIA;
go
-- QUOCGIA_DELETE
CREATE PROCEDURE p10_QUOCGIA_DELETE
	@maqg VARCHAR(5)
AS
BEGIN
	DELETE QUOCGIA
	WHERE MAQG = @maqg
END;
-- exec
SELECT * FROM QUOCGIA;
EXEC p10_QUOCGIA_DELETE 'CHN';
SELECT * FROM QUOCGIA;
go
-- QUOCGIA_SELECT
CREATE PROCEDURE p10_QUOCGIA_SELECT
AS
BEGIN
	SELECT * FROM QUOCGIA
END;
-- exec
EXEC p10_QUOCGIA_SELECT;
go
/* Bảng TINH */
-- TINH_INSERT
CREATE PROCEDURE p10_TINH_INSERT
	@matinh VARCHAR(5), @tentinh NVARCHAR(100)
AS
BEGIN
	INSERT INTO TINH(MATINH, TENTINH)
	VALUES (@matinh, @tentinh)
END;
-- exec
SELECT * FROM TINH;
EXEC p10_TINH_INSERT 'TB', N'TBinh';
SELECT * FROM TINH;
go
-- TINH_UPDATE
CREATE PROCEDURE p10_TINH_UPDATE
	@matinh VARCHAR(5), @tentinh NVARCHAR(100)
AS
BEGIN
	UPDATE TINH
	SET TENTINH = @tentinh
	WHERE MATINH = @matinh
END;
-- exec
SELECT * FROM TINH;
EXEC p10_TINH_UPDATE 'TB', N'Thái Bình';
SELECT * FROM TINH;
go
-- TINH_DELETE
CREATE PROCEDURE p10_TINH_DELETE
	@matinh VARCHAR(5)
AS
BEGIN
	DELETE TINH
	WHERE MATINH = @matinh
END;
-- exec
SELECT * FROM TINH;
EXEC p10_TINH_DELETE 'TB';
SELECT * FROM TINH;
go
-- TINH_SELECT
CREATE PROCEDURE p10_TINH_SELECT
AS
BEGIN
	SELECT * FROM TINH
END;
-- exec
EXEC p10_TINH_SELECT;
go

/* Bảng SANVD */
-- SANVD_INSERT
CREATE PROCEDURE p10_SANVD_INSERT
	@masan VARCHAR(5), @tensan NVARCHAR(100), @diachi NVARCHAR(200)
AS
BEGIN
	INSERT INTO SANVD(MASAN, TENSAN, DIACHI)
	VALUES (@masan, @tensan, @diachi)
END;
-- exec
SELECT * FROM SANVD;
EXEC p10_SANVD_INSERT 'BK', N'Bách Khoa', N'Tạ Quang Bửu, quận Hai Bà Trưng, TP. Hà Nội';
SELECT * FROM SANVD;
go
-- SANVD_UPDATE
CREATE PROCEDURE p10_SANVD_UPDATE
	@masan VARCHAR(5), @tensan NVARCHAR(100), @diachi NVARCHAR(200)
AS
BEGIN
	UPDATE SANVD
	SET TENSAN = @tensan, DIACHI = @diachi
	WHERE MASAN = @masan
END;
-- exec
SELECT * FROM SANVD;
EXEC p10_SANVD_UPDATE 'BK', N'Đại học Bách Khoa', N'Trần Đại Nghĩa, quận Hai Bà Trưng, TP. Hà Nội';
SELECT * FROM SANVD;
go
-- SANVD_DELETE
CREATE PROCEDURE p10_SANVD_DELETE
	@masan VARCHAR(5)
AS
BEGIN
	DELETE SANVD
	WHERE MASAN = @masan
END;
-- exec
SELECT * FROM SANVD;
EXEC p10_SANVD_DELETE 'BK';
SELECT * FROM SANVD;
go
-- SANVD_SELECT
CREATE PROCEDURE p10_SANVD_SELECT
AS
BEGIN
	SELECT * FROM SANVD
END;
-- exec
EXEC p10_SANVD_SELECT;
go

/* Bảng HUANLUYENVIEN */
-- HUANLUYENVIEN_INSERT
CREATE PROCEDURE p10_HUANLUYENVIEN_INSERT
	@mahlv VARCHAR(5),
	@tenhlv NVARCHAR(100),
	@ngaysinh DATETIME,
	@diachi NVARCHAR(200),
	@dienthoai NVARCHAR(20),
	@maqg VARCHAR(5)
AS
BEGIN
	INSERT INTO HUANLUYENVIEN(MAHLV, TENHLV, NGAYSINH, DIACHI, DIENTHOAI, MAQG)
	VALUES (@mahlv, @tenhlv, @ngaysinh, @diachi, @dienthoai, @maqg)
END;
-- exec
SELECT * FROM HUANLUYENVIEN;
EXEC p10_HUANLUYENVIEN_INSERT HLV07, N'Đinh Hoàng Tùng', '10-22-2003', NULL, '0904371153', 'VN';
SELECT * FROM HUANLUYENVIEN;
go
-- HUANLUYENVIEN_UPDATE
CREATE PROCEDURE p10_HUANLUYENVIEN_UPDATE
	@mahlv VARCHAR(5),
	@tenhlv NVARCHAR(100),
	@ngaysinh DATETIME,
	@diachi NVARCHAR(200),
	@dienthoai NVARCHAR(20),
	@maqg VARCHAR(5)
AS
BEGIN
	UPDATE HUANLUYENVIEN
	SET TENHLV = @tenhlv,
		NGAYSINH = @ngaysinh,
		DIACHI = @diachi,
		DIENTHOAI = @dienthoai,
		MAQG = @maqg
	WHERE MAHLV = @mahlv
END;
-- exec
SELECT * FROM HUANLUYENVIEN;
EXEC p10_HUANLUYENVIEN_UPDATE HLV07, N'Trần Ngọc Nam', '07-15-2001', NULL, '087493729', 'VN';
SELECT * FROM HUANLUYENVIEN;
go
-- HUANLUYENVIEN_DELETE
CREATE PROCEDURE p10_HUANLUYENVIEN_DELETE
	@mahlv VARCHAR(5)
AS
BEGIN
	DELETE HUANLUYENVIEN
	WHERE MAHLV = @mahlv
END;
-- exec
SELECT * FROM HUANLUYENVIEN;
EXEC p10_HUANLUYENVIEN_DELETE HLV07;
SELECT * FROM HUANLUYENVIEN;
go
-- HUANLUYENVIEN_SELECT
CREATE PROCEDURE p10_HUANLUYENVIEN_SELECT
AS
BEGIN
	SELECT * FROM HUANLUYENVIEN
END;
-- exec
EXEC p10_HUANLUYENVIEN_SELECT;
go

/* Bảng CAULACBO */
-- CAULACBO_INSERT
CREATE PROCEDURE p10_CAULACBO_INSERT
	@maclb VARCHAR(5),
	@tenclb NVARCHAR(100),
	@masan VARCHAR(5),
	@matinh VARCHAR(5)
AS
BEGIN
	INSERT INTO CAULACBO(MACLB, TENCLB, MASAN, MATINH)
	VALUES (@maclb, @tenclb, @masan, @matinh)
END;
-- exec
SELECT * FROM CAULACBO;
EXEC p10_CAULACBO_INSERT 'HPC', N'Hải Phòng Club', 'CL', 'DN';
SELECT * FROM CAULACBO;
go
-- CAULACBO_UPDATE
CREATE PROCEDURE p10_CAULACBO_UPDATE
	@maclb VARCHAR(5),
	@tenclb NVARCHAR(100),
	@masan VARCHAR(5),
	@matinh VARCHAR(5)
AS
BEGIN
	UPDATE CAULACBO
	SET TENCLB = @tenclb,
		MASAN = @masan,
		MATINH = @matinh
	WHERE MACLB = @maclb
END;
-- exec
SELECT * FROM CAULACBO;
EXEC p10_CAULACBO_UPDATE 'HPC', N'CLB Hải Phòng', 'NT', 'PY';
SELECT * FROM CAULACBO;
go
-- CAULACBO_DELETE
CREATE PROCEDURE p10_CAULACBO_DELETE
	@maclb VARCHAR(5)
AS
BEGIN
	DELETE CAULACBO
	WHERE MACLB = @maclb
END;
-- exec
SELECT * FROM CAULACBO;
EXEC p10_CAULACBO_DELETE 'HPC';
SELECT * FROM CAULACBO;
go
-- CAULACBO_SELECT
CREATE PROCEDURE p10_CAULACBO_SELECT
AS
BEGIN
	SELECT * FROM CAULACBO
END;
-- exec
EXEC p10_CAULACBO_SELECT;
go

/* Bảng HLV_CLB */
-- HLV_CLB_INSERT
CREATE PROCEDURE p10_HLV_CLB_INSERT
	@mahlv VARCHAR(5), 
	@maclb VARCHAR(5),
	@vaitro NVARCHAR(100)
AS
BEGIN
	INSERT INTO HLV_CLB
	VALUES (@mahlv, @maclb, @vaitro)
END;
-- exec
SELECT * FROM HLV_CLB;
EXEC p10_HLV_CLB_INSERT 'HLV05', 'KKH', N'HLV thể lực';
SELECT * FROM HLV_CLB;
go
-- HLV_CLB_UPDATE
CREATE PROCEDURE p10_HLV_CLB_UPDATE
	@mahlv VARCHAR(5), 
	@maclb VARCHAR(5),
	@vaitro NVARCHAR(100)
AS
BEGIN
	UPDATE HLV_CLB
	SET VAITRO = @vaitro
	WHERE MAHLV = @mahlv AND MACLB = @maclb
END;
-- exec
SELECT * FROM HLV_CLB;
EXEC p10_HLV_CLB_UPDATE 'HLV05', 'KKH', N'HLV phụ';
SELECT * FROM HLV_CLB;
go
-- HLV_CLB_DELETE
CREATE PROCEDURE p10_HLV_CLB_DELETE
	@mahlv VARCHAR(5), 
	@maclb VARCHAR(5)
AS
BEGIN
	DELETE HLV_CLB
	WHERE MAHLV = @mahlv AND MACLB = @maclb
END;
-- exec
SELECT * FROM HLV_CLB;
EXEC p10_HLV_CLB_DELETE 'HLV05', 'KKH';
SELECT * FROM HLV_CLB;
go
-- HLV_CLB_SELECT
CREATE PROCEDURE p10_HLV_CLB_SELECT
AS
BEGIN
	SELECT * FROM HLV_CLB
END;
-- exec
EXEC p10_CAULACBO_SELECT;
go

/* Bảng CAUTHU */
-- CAUTHU_INSERT
CREATE PROCEDURE p10_CAUTHU_INSERT
	-- MACT tăng tự động: MACT NUMERIC IDENTITY(1,1)
	@hoten NVARCHAR(100),
	@vitri NVARCHAR(20),
	@ngaysinh DATETIME,
	@diachi NVARCHAR(200),
	@maclb VARCHAR(5),
	@maqg VARCHAR(5),
	@so INT
AS
BEGIN
	INSERT INTO CAUTHU(HOTEN, VITRI, NGAYSINH, DIACHI, MACLB, MAQG, SO)
	VALUES (@hoten, @vitri, @ngaysinh, @diachi, @maclb, @maqg, @so)
END;
-- exec
SELECT * FROM CAUTHU;
EXEC p10_CAUTHU_INSERT N'Ngô Trung Hiếu', N'Trung vệ', '04-17-2002', NULL, 'GDT', 'VN', 5;
SELECT * FROM CAUTHU;
go
-- CAUTHU_UPDATE
CREATE PROCEDURE p10_CAUTHU_UPDATE
	@mact NUMERIC,
	@hoten NVARCHAR(100),
	@vitri NVARCHAR(20),
	@ngaysinh DATETIME,
	@diachi NVARCHAR(200),
	@maclb VARCHAR(5),
	@maqg VARCHAR(5),
	@so INT
AS
BEGIN
	UPDATE CAUTHU
	SET HOTEN = @hoten,
		VITRI = @vitri,
		NGAYSINH = @ngaysinh,
		DIACHI = @diachi,
		MACLB = @maclb,
		MAQG = @maqg,
		SO = @so
	WHERE MACT = @mact
END;
-- exec
SELECT * FROM CAUTHU;
EXEC p10_CAUTHU_UPDATE 12, N'Ngô Trung Hiếu', N'Hậu vệ', '07-09-2002', NULL, 'HAGL', 'VN', 6;
SELECT * FROM CAUTHU;
go
-- CAUTHU_DELETE
CREATE PROCEDURE p10_CAUTHU_DELETE
	@mact NUMERIC
AS
BEGIN
	DELETE CAUTHU
	WHERE MACT = @mact
END;
-- exec
SELECT * FROM CAUTHU;
EXEC p10_CAUTHU_DELETE 12;
SELECT * FROM CAUTHU;
go
-- CAUTHU_SELECT
CREATE PROCEDURE p10_CAUTHU_SELECT
AS
BEGIN
	SELECT * FROM CAUTHU
END;
-- exec
EXEC p10_CAUTHU_SELECT;
go

/* Bảng TRANDAU */
-- TRANDAU_INSERT
CREATE PROCEDURE p10_TRANDAU_INSERT
	-- MATRAN tăng tự động: MATRAN NUMERIC IDENTITY(1,1)
	@nam INT, 
	@vong INT, 
	@ngaytd DATETIME,
	@maclb1 VARCHAR(5), 
	@maclb2 VARCHAR(5),
	@masan VARCHAR(5), 
	@ketqua VARCHAR(5)
AS
BEGIN
	INSERT INTO TRANDAU(NAM, VONG, NGAYTD, MACLB1, MACLB2, MASAN, KETQUA)
	VALUES (@nam, @vong, @ngaytd, @maclb1, @maclb2, @masan, @ketqua)
END;
-- exec
SELECT * FROM TRANDAU;
EXEC p10_TRANDAU_INSERT 2009, 5, '03-10-2009', 'SDN', 'HAGL', 'TH', '2-0';
SELECT * FROM TRANDAU;
go
-- TRANDAU_UPDATE
CREATE PROCEDURE p10_TRANDAU_UPDATE
	@matran NUMERIC,
	@nam INT, 
	@vong INT, 
	@ngaytd DATETIME,
	@maclb1 VARCHAR(5), 
	@maclb2 VARCHAR(5),
	@masan VARCHAR(5), 
	@ketqua VARCHAR(5)
AS
BEGIN
	UPDATE TRANDAU
	SET NAM = @nam,
		VONG = @vong,
		NGAYTD = @ngaytd,
		MACLB1 = @maclb1,
		MACLB2 = @maclb2,
		MASAN = @masan,
		KETQUA = @ketqua
	WHERE MATRAN = @matran
END;
-- exec
SELECT * FROM TRANDAU;
EXEC p10_TRANDAU_UPDATE 9, 2009, 5, '03-15-2009', 'KKH', 'BBD', 'CL', '3-1';
SELECT * FROM TRANDAU;
go
-- TRANDAU_DELETE
CREATE PROCEDURE p10_TRANDAU_DELETE
	@matran NUMERIC
AS
BEGIN
	DELETE TRANDAU
	WHERE MATRAN = @matran
END;
-- exec
SELECT * FROM TRANDAU;
EXEC p10_TRANDAU_DELETE 9;
SELECT * FROM TRANDAU;
go
-- TRANDAU_SELECT
CREATE PROCEDURE p10_TRANDAU_SELECT
AS
BEGIN
	SELECT * FROM TRANDAU;
END;
-- exec
EXEC p10_TRANDAU_SELECT;
go

/* Bảng BANGXH */
-- BANGXH_INSERT
CREATE PROCEDURE p10_BANGXH_INSERT
	@maclb VARCHAR(5),
	@nam INT,
	@vong INT,
	@sotran INT,
	@thang INT,
	@hoa INT,
	@thua INT,
	@hieuso VARCHAR(5),
	@diem INT,
	@hang INT
AS
BEGIN
	INSERT INTO BANGXH(MACLB, NAM, VONG, SOTRAN, THANG, HOA, THUA, HIEUSO, DIEM, HANG)
	VALUES (@maclb, @nam, @vong, @sotran, @thang, @hoa, @thua, @hieuso, @diem, @hang)
END;
-- exec
SELECT * FROM BANGXH;
EXEC p10_BANGXH_INSERT 'BBD', 2009, 5, 3, 2, 1, 1, '5-4', 2, 5;
SELECT * FROM BANGXH;
go
-- BANGXH_UPDATE
CREATE PROCEDURE p10_BANGXH_UPDATE
	@maclb VARCHAR(5),
	@nam INT,
	@vong INT,
	@sotran INT,
	@thang INT,
	@hoa INT,
	@thua INT,
	@hieuso VARCHAR(5),
	@diem INT,
	@hang INT
AS
BEGIN
	UPDATE BANGXH
	SET SOTRAN = @sotran,
		THANG = @thang,
		HOA = @hoa,
		THUA = @thua,
		HIEUSO = @hieuso,
		DIEM = @diem,
		HANG = @hang
	WHERE MACLB = @maclb AND NAM = @nam AND VONG = @vong
END;
-- exec
SELECT * FROM BANGXH;
EXEC p10_BANGXH_UPDATE 'BBD', 2009, 5, 4, 1, 1, 2, '6-3', 1, 7;
SELECT * FROM BANGXH;
go
-- BANGXH_DELETE
CREATE PROCEDURE p10_BANGXH_DELETE
	@maclb VARCHAR(5),
	@nam INT,
	@vong INT
AS
BEGIN
	DELETE BANGXH
	WHERE MACLB = @maclb AND NAM = @nam AND VONG = @vong
END;
-- exec
SELECT * FROM BANGXH;
EXEC p10_BANGXH_DELETE 'BBD', 2009, 5;
SELECT * FROM BANGXH;
go
-- BANGXH_SELECT
CREATE PROCEDURE p10_BANGXH_SELECT
AS
BEGIN
	SELECT * FROM BANGXH
END;
-- exec
EXEC p10_BANGXH_SELECT;
go

--b, bài tập về trigger
-- 1. Khi thêm cầu thủ mới, kiểm tra vị trí trên sân của cần thủ chỉ thuộc một 
CREATE TRIGGER trg1 ON CAUTHU FOR INSERT AS
BEGIN
    IF EXISTS (
        SELECT 1 FROM inserted 
        WHERE VITRI NOT IN (N'Thủ môn', N'Tiền đạo', N'Tiền vệ', N'Trung vệ', N'Hậu vệ')
    )
    BEGIN
        ROLLBACK TRANSACTION;
    END
END;
GO

--2, Khi thêm cầu thủ mới, kiểm tra số áo của cầu thủ thuộc cùng một câu lạc 
--bộ phải khác nhau. 
CREATE TRIGGER trg2 ON CAUTHU FOR INSERT AS
BEGIN
    IF EXISTS (
        SELECT 1 FROM CAUTHU C JOIN inserted i ON C.MACLB = i.MACLB AND C.SO = i.SO WHERE C.MACT <> i.MACT
        UNION ALL
        SELECT 1 FROM inserted GROUP BY MACLB, SO HAVING COUNT(*) > 1
    )
    BEGIN
        ROLLBACK TRANSACTION;
    END
END;
GO

--3, Khi thêm thông tin cầu thủ thì in ra câu thông báo bằng Tiếng Việt ‘ 
--Đã thêm cầu thủ mới’. 
CREATE TRIGGER trg3 ON CAUTHU FOR INSERT AS
BEGIN
    PRINT N'Đã thêm cầu thủ mới';
END;
GO

--4, Khi thêm cầu thủ mới, kiểm tra số lượng cầu thủ nước ngoài ở mỗi câu lạc 
--bộ chỉ được phép đăng ký tối đa 8 cầu thủ. 
CREATE TRIGGER trg4 ON CAUTHU FOR INSERT AS
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM CAUTHU 
        WHERE MAQG <> 'VN' AND MACLB IN (SELECT DISTINCT MACLB FROM inserted)
        GROUP BY MACLB 
        HAVING COUNT(*) > 8
    )
    BEGIN
        ROLLBACK TRANSACTION;
    END
END;
GO
--5, Khi thêm tên quốc gia, kiểm tra tên quốc gia không được trùng với tên 
--quốc gia đã có. 
CREATE TRIGGER trg5 ON QUOCGIA FOR INSERT AS
BEGIN
    IF EXISTS (
        SELECT 1 FROM QUOCGIA Q JOIN inserted i ON Q.TENQG = i.TENQG WHERE Q.MAQG <> i.MAQG
    )
    BEGIN
        ROLLBACK TRANSACTION;
    END
END;
GO

--6, Khi thêm tên tỉnh thành, kiểm tra tên tỉnh thành không được trùng với 
--tên tỉnh thành đã có. 
CREATE TRIGGER trg6 ON TINH FOR INSERT AS
BEGIN
    IF EXISTS (
        SELECT 1 FROM TINH T JOIN inserted i ON T.TENTINH = i.TENTINH WHERE T.MATINH <> i.MATINH
    )
    BEGIN
        ROLLBACK TRANSACTION;
    END
END;
GO

--7, Không cho sửa kết quả của các trận đã diễn ra.
CREATE TRIGGER trg7 ON TRANDAU FOR UPDATE AS
BEGIN
    IF UPDATE(KETQUA) AND EXISTS (
        SELECT 1 
        FROM inserted i 
        JOIN deleted d ON i.MATRAN = d.MATRAN
        WHERE d.KETQUA IS NOT NULL AND d.KETQUA <> i.KETQUA
    )
    BEGIN
        ROLLBACK TRANSACTION;
    END
END;
GO
--8, Khi phân công huấn luyện viên cho câu lạc bộ: 
--8a,Kiểm tra vai trò của huấn luyện viên chỉ thuộc một trong các vai trò sau: 
--HLV chính, HLV phụ, HLV thể lực, HLV thủ môn 
CREATE TRIGGER trg8a ON HLV_CLB FOR INSERT, UPDATE AS
BEGIN
    IF EXISTS (
        SELECT 1 FROM inserted 
        WHERE VAITRO NOT IN (N'HLV chính', N'HLV phụ', N'HLV thể lực', N'HLV thủ môn')
    )
    BEGIN
        ROLLBACK TRANSACTION;
    END
END;
GO

--8B, Kiểm tra mỗi câu lạc bộ chỉ có tối đa 2 HLV chính. 
CREATE TRIGGER trg8b ON HLV_CLB FOR INSERT, UPDATE AS
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM HLV_CLB 
        WHERE VAITRO = N'HLV chính' AND MACLB IN (SELECT DISTINCT MACLB FROM inserted)
        GROUP BY MACLB 
        HAVING COUNT(*) > 2
    )
    BEGIN
        ROLLBACK TRANSACTION;
    END
END;
GO
--9,  Khi thêm mới một câu lạc bộ thì kiểm tra xem đã có câu lạc bộ trùng tên 
--9c,chỉ thông báo vẫn cho insert.
CREATE TRIGGER trg9c ON CAULACBO FOR INSERT AS
BEGIN
    IF EXISTS (
        SELECT 1 FROM CAULACBO C JOIN inserted i ON C.TENCLB = i.TENCLB WHERE C.MACLB <> i.MACLB
    )
    BEGIN
        PRINT N'Cảnh báo: Tên câu lạc bộ đã tồn tại!';
    END
END;
GO

--9d,
CREATE TRIGGER trg9d ON CAULACBO FOR INSERT AS
BEGIN
    IF EXISTS (
        SELECT 1 FROM CAULACBO C JOIN inserted i ON C.TENCLB = i.TENCLB WHERE C.MACLB <> i.MACLB
    )
    BEGIN
        ROLLBACK TRANSACTION;
    END
END;
GO

--10
CREATE TRIGGER trg10 ON CAUTHU FOR UPDATE AS
BEGIN
    IF UPDATE(HOTEN) AND EXISTS (
        SELECT 1 FROM inserted i JOIN deleted d ON i.MACT = d.MACT WHERE i.HOTEN <> d.HOTEN
    )
    BEGIN
        -- e. Danh sách mã cầu thủ của các cầu thủ vừa được sửa.
        SELECT i.MACT 
        FROM inserted i 
        JOIN deleted d ON i.MACT = d.MACT 
        WHERE i.HOTEN <> d.HOTEN;

        -- f. Danh sách mã cầu thủ vừa được sửa và tên cầu thủ mới.
        SELECT i.MACT, i.HOTEN 
        FROM inserted i 
        JOIN deleted d ON i.MACT = d.MACT 
        WHERE i.HOTEN <> d.HOTEN;

        -- g. Danh sách mã cầu thủ vừa được sửa và tên cầu thủ cũ.
        SELECT d.MACT, d.HOTEN 
        FROM inserted i 
        JOIN deleted d ON i.MACT = d.MACT 
        WHERE i.HOTEN <> d.HOTEN;

        -- h. Danh sách mã cầu thủ vừa được sửa và tên cầu thủ cũ và cầu thủ mới.
        SELECT i.MACT, d.HOTEN AS HOTEN_CU, i.HOTEN AS HOTEN_MOI 
        FROM inserted i 
        JOIN deleted d ON i.MACT = d.MACT 
        WHERE i.HOTEN <> d.HOTEN;

        -- i. Câu thông báo bằng Tiếng Việt.
        DECLARE @MaSua VARCHAR(10);
        DECLARE cur CURSOR LOCAL FOR 
            SELECT i.MACT 
            FROM inserted i 
            JOIN deleted d ON i.MACT = d.MACT 
            WHERE i.HOTEN <> d.HOTEN;
            
        OPEN cur;
        FETCH NEXT FROM cur INTO @MaSua;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            PRINT N'Vừa sửa thông tin của cầu thủ có mã số ' + @MaSua;
            FETCH NEXT FROM cur INTO @MaSua;
        END;
        CLOSE cur;
        DEALLOCATE cur;
    END
END;
GO