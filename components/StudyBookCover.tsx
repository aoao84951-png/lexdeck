import Image from "next/image";

export function NoCover({preview=false}:{preview?:boolean}) {
 return <span role="img" aria-label="표지 없음" className={`study-book-cover study-book-no-cover ${preview?'is-preview':''}`}><span aria-hidden="true">BOOK</span></span>;
}
export default function StudyBookCover({coverImage,isBook,title}:{coverImage?:string;isBook?:boolean;title:string}) {
 if(coverImage) return <Image unoptimized width={36} height={52} src={coverImage} alt={`${title} 표지`} className="study-book-cover"/>;
 return isBook?<NoCover/>:null;
}
