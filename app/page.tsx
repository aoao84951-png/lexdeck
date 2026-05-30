"use client";

import { useEffect, useState } from "react";

import MobileApp from "@/components/MobileApp";
import DesktopApp from "@/components/DesktopApp";

export default function Home() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkScreen = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    checkScreen();

    window.addEventListener("resize", checkScreen);

    return () => {
      window.removeEventListener("resize", checkScreen);
    };
  }, []);

  return isDesktop ? <DesktopApp /> : <MobileApp />;
}