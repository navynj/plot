import Nav from '@/components/layout/Nav';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <body className="relative max-w-[1280px] mx-auto lg:flex lg:mt-48">
      {/* content */}
      <main className="w-full h-[calc(100vh-6rem)] lg:h-auto overflow-scroll p-4 lg:flex lg:space-x-16">
        {children}
      </main>
      {/* nav */}
      <Nav className="h-[6rem] lg:h-auto lg:p-8 lg:flex lg:flex-col lg:justify-start lg:items-center" />
      {/* overlays */}
      <div id="overlay-container" className="absolute" />
      <div
        id="overlay-container-tl"
        className="absolute top-0 left-0 w-full lg:w-[50%]"
      />
      <div
        id="overlay-container-tr"
        className="absolute top-0 right-0 w-full lg:w-[50%]"
      />
      <div
        id="overlay-container-bl"
        className="absolute bottom-0 left-0 w-full lg:w-[50%]"
      />
      <div
        id="overlay-container-br"
        className="absolute bottom-0 right-0 w-full lg:w-[50%]"
      />
    </body>
  );
}
