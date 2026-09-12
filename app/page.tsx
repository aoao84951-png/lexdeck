"use client";

import { useEffect, useState } from "react";

import MobileApp from "@/components/MobileApp";
import DesktopApp from "@/components/DesktopApp";
import { DESKTOP_MEDIA_QUERY } from "@/components/responsiveLayout";

export default function Home() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const checkScreen = () => {
      setIsDesktop(media.matches);
    };

    checkScreen();

    media.addEventListener("change", checkScreen);

    return () => {
      media.removeEventListener("change", checkScreen);
    };
  }, []);

  return isDesktop ? <DesktopApp /> : <MobileApp />;
}
