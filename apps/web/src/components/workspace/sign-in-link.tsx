import Link from "next/link";

export function SignInLink() {
  return (
    <Link
      href="/sign-in"
      className="rounded-full bg-white px-5 py-2 text-xs font-medium text-black transition-colors hover:bg-gray-200"
    >
      Sign in as operator
    </Link>
  );
}
