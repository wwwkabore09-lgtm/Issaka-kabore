export default function AdminHomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-semibold">Finza Admin</h1>
      <p className="text-slate-500">
        Interface interne — accès restreint. Toute route donnant accès à des données
        financières en clair doit être journalisée et validée en double.
      </p>
    </main>
  );
}
