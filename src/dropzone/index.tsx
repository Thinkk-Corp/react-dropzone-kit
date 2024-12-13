import { type HTMLAttributes, type InputHTMLAttributes, type RefObject, useEffect, useState, useRef } from "react";
import type { IDropzone, IFileError, IFileErrorTypes, IFileRejection } from "@/interfaces";
import { DropzoneErrorCode } from "@/enums";

/**
 * Dropzone bileşeni, dosya yükleme işlemleri için kullanılan bir React bileşenidir.
 * @param {IDropzone} props - Dropzone bileşenine iletilen özellikler.
 * @param {Function} props.onDrop - Geçerli ve reddedilen dosyaları döndüren bir işlev.
 * @param {(rejections:IFileRejection[]) => void} props.onDropRejected - Reddedilen dosyaları sağlayan event.
 * @param {(files:File[]) => void} props.onDropAccepted - Kabul edilen dosyaları sağlayan event.
 * @param {boolean} [props.multiple=true] - Birden fazla dosya yükleme desteği.
 * @param {string[]} [props.acceptedFormats] - Kabul edilen dosya türleri.
 * @param {number} [props.maxFiles] - Maksimum yüklenebilir dosya sayısı.
 * @param {number} [props.maxSize] - Yüklenebilir maksimum dosya boyutu (byte).
 * @param {number} [props.minSize] - Yüklenebilir minimum dosya boyutu (byte).
 * @param {IFileError[]} [props.validationMessages] - Özel hata mesajları.
 * @param {Function} props.children - Özelleştirilmiş içerik işlevi.
 * @returns {JSX.Element | null} Dropzone bileşeni.
 */
export const Dropzone = ({
	onDrop,
	onDropRejected,
	onDropAccepted,
	multiple = true,
	acceptedFormats,
	maxFiles,
	maxSize,
	minSize,
	validationMessages,
	children,
	...props
}: IDropzone) => {
	// İç hata mesajları state'i
	const [internalValidationMessages, setInternalValidationMessages] = useState<IFileError[] | undefined>(validationMessages);
	const [isDragActive, setIsDragActive] = useState<boolean>(false);

	// Yüklenmiş dosyalar state'i
	const [files, setFiles] = useState<File[]>([]);

	// input elementine referans
	const inputRef = useRef<HTMLInputElement>(null);

	// Varsayılan doğrulama mesajları
	const defaultValidationMessages: IFileError[] = [
		{
			code: DropzoneErrorCode.FileInvalidType,
			message: `Geçersiz dosya türü. Sadece şu türler destekleniyor: ${acceptedFormats.join(", ")}.`,
		},
		{
			code: DropzoneErrorCode.FileTooLarge,
			message: "Dosya boyutu çok büyük.",
		},
		{
			code: DropzoneErrorCode.FileTooSmall,
			message: "Dosya boyutu çok küçük.",
		},
		{
			code: DropzoneErrorCode.TooManyFiles,
			message: `Maksimum dosya sayısını aştınız. En fazla ${maxFiles} dosya yükleyebilirsiniz.`,
		},
	];

	// Belirli bir doğrulama kodu için hata mesajını bulur.
	const validationFinder = (code: IFileErrorTypes) => {
		return internalValidationMessages?.find((validation) => validation.code === code) || null;
	};

	// Maksimum dosya sayısını doğrular.
	const tooManyFiles = () => {
		const validation = validationFinder("too-many-files");
		if (!validation || !maxFiles || files.length <= maxFiles) return;
		return validation;
	};

	// Dosya türünü doğrular.
	const fileInvalidType = (file: File) => {
		const fileType = file.type;
		const validation = validationFinder("file-invalid-type");

		const isValidType = acceptedFormats.some((format) => {
			if (format.startsWith(".")) {
				return file.name.endsWith(format);
			}
			return fileType.startsWith(format);
		});
		if (isValidType || !validation) return;
		return validation;
	};

	// Dosya boyutunu (çok büyük) doğrular.
	const fileTooLarge = (file: File) => {
		const validation = validationFinder("file-too-large");
		if (!validation || !maxSize || file.size <= maxSize) return;
		return validation;
	};

	// Dosya boyutunu (çok küçük) doğrular.
	const fileTooSmall = (file: File) => {
		const validation = validationFinder("file-too-small");
		if (!validation || !minSize || file.size >= minSize) return;
		return validation;
	};

	/**
	 * Dosyaları doğrulayan yardımcı işlev.
	 * @param {File[]} files - Doğrulanacak dosyalar.
	 * @returns {IFileRejection[]} Reddedilen dosyalar ve hata bilgileri.
	 */
	const validator = (files: File[]) => {
		const rejections: IFileRejection[] = [];

		for (const file of files) {
			const fileRejections: IFileError[] = [];

			const tooManyFilesError = tooManyFiles();
			if (tooManyFilesError) fileRejections.push(tooManyFilesError);

			const invalidTypeError = fileInvalidType(file);
			if (invalidTypeError) fileRejections.push(invalidTypeError);

			const tooLargeError = fileTooLarge(file);
			if (tooLargeError) fileRejections.push(tooLargeError);

			const tooSmallError = fileTooSmall(file);
			if (tooSmallError) fileRejections.push(tooSmallError);

			if (fileRejections.length > 0) {
				rejections.push({ file, error: fileRejections });
			}
		}

		return rejections;
	};

	/**
	 * Dosya bırakma veya dosya seçme işlemini yönetir.
	 * @param {React.DragEvent<HTMLDivElement> | React.ChangeEvent<HTMLInputElement>} event - Olay nesnesi.
	 */
	const handleDrop = (event: React.DragEvent<HTMLDivElement> | React.ChangeEvent<HTMLInputElement>) => {
		event.preventDefault();

		let newFiles: File[] = [];

		// Drag and Drop işlemi mi yoksa input değişikliği mi olduğunu kontrol eder.
		if ("dataTransfer" in event) {
			newFiles = Array.from(event.dataTransfer.files);
		} else if (event.target?.files) {
			newFiles = Array.from(event.target.files);
		}

		if (!newFiles.length) return;

		// Aynı isimdeki dosyaları filtreler.
		const uniquedFiles = newFiles.filter((newFile) => !files.some((file) => file.name === newFile.name));

		setFiles((prev) => [...prev, ...uniquedFiles]);
	};

	/**
	 * Drag over olayını yönetir.
	 * @param {React.DragEvent<HTMLDivElement>} event - Olay nesnesi.
	 */
	const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
		event.preventDefault();
	};

	/**
	 * Drag işlemi başladığında veya bittiğinde tetiklenir.
	 * @param {React.DragEvent<HTMLInputElement>} _e - Olay nesnesi.
	 * @param {"enter" | "leave"} type - Drag durumu.
	 */
	const handleDrag = (_e: React.DragEvent<HTMLInputElement>, type: "enter" | "leave") => {
		if (type === "enter") {
			return setIsDragActive(true);
		}
		setIsDragActive(false);
	};

	/**
	 * Bir dosyayı listeden siler.
	 * @param {File} file - Silinecek dosya.
	 */
	const handleFileDelete = (file: File) => {
		setFiles((prevFiles) => prevFiles.filter((f) => f !== file));
	};

	// Container özellikleri
	const containerProps: HTMLAttributes<HTMLDivElement> = {
		className: "dropzone-container",
		style: {
			position: "relative",
		},
		onDragOver: handleDragOver,
	};

	// Input özellikleri
	const inputProps: InputHTMLAttributes<HTMLInputElement> & { ref: RefObject<HTMLInputElement> } = {
		className: "dropzone-input",
		style: {
			position: "absolute",
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			width: "100%",
			height: "100%",
			opacity: 0,
			cursor: "pointer",
		},
		ref: inputRef,
		multiple,
		accept: acceptedFormats ? acceptedFormats.join(", ") : undefined,
		type: "file",
		role: "textbox",
		onDrop: handleDrop,
		onChange: handleDrop,
		onDragEnter: (e) => handleDrag(e, "enter"),
		onDragLeave: (e) => handleDrag(e, "leave"),
		...props,
	};

	useEffect(() => {
		if (validationMessages) return;
		setInternalValidationMessages(defaultValidationMessages);
	}, [validationMessages]);

	useEffect(() => {
		const rejections = validator(files);
		const validFiles = files.filter((file) => !rejections.some((rejection) => rejection.file.name === file.name));

		onDrop?.(validFiles, rejections, inputRef);

		if (validFiles.length > 0) {
			onDropAccepted?.(validFiles);
		}

		if (rejections.length > 0) {
			onDropRejected?.(rejections);
		}

		if (!inputRef.current) return;
		const dataTransfer = new DataTransfer();

		for (const file of validFiles) {
			dataTransfer.items.add(file);
		}

		inputRef.current.files = dataTransfer.files;
	}, [files]);

	if (typeof children !== "function") return null;

	return <div>{children({ containerProps, inputProps, handleFileDelete, isDragActive })}</div>;
};