import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Seeds a small Ugandan family web. Deliberately includes the awkward cases —
 * a minor, a deceased great-grandparent with no known birth year, and a locked
 * node — so the privacy rules are visible in the running app, not just in tests.
 *
 * Everything here is invented. No real person is represented.
 */
async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const amina = await prisma.user.upsert({
    where: { email: "amina@example.com" },
    update: {},
    create: { email: "amina@example.com", passwordHash, displayName: "Amina" },
  });

  const mk = (data: Parameters<typeof prisma.person.create>[0]["data"]) =>
    prisma.person.create({ data });

  // Claimed her own profile, opted in to public.
  const aminaP = await mk({
    displayName: "Amina Nakato",
    birthYear: 1992, birthYearIsExact: true,
    bio: "Software engineer in Kampala. Started this web.",
    privacyTier: "PUBLIC",
    claimedByUserId: amina.id, claimedAt: new Date(),
    addedByUserId: amina.id, verified: true,
  });

  // Living relatives — default FAMILY_ONLY, untouched.
  const mother = await mk({
    displayName: "Sarah Nabirye", birthYear: 1965,
    bio: "Teacher. Remembers everyone's birthdays.", addedByUserId: amina.id,
  });
  const father = await mk({
    displayName: "Joseph Mukasa", birthYear: 1961, addedByUserId: amina.id,
  });
  const brother = await mk({
    displayName: "David Mukasa", birthYear: 1997, addedByUserId: amina.id,
  });

  // A minor: never public, never searchable, photo withheld (no guardian).
  const niece = await mk({
    displayName: "Grace Mukasa", birthYear: 2016,
    photoUrl: "https://example.test/grace.jpg",
    addedByUserId: amina.id,
  });

  // Deceased, no known birth year — the common genealogical case. Cause of
  // death stays freeform text, never a structured health field.
  const grandmother = await mk({
    displayName: "Esther Nabirye", birthYear: null, deathYear: 1998,
    deceasedNotes: "Died in Jinja. Family remembers a long illness; no records kept.",
    privacyTier: "PUBLIC", addedByUserId: amina.id,
  });

  // Someone who asked to be removed. Stays in the graph so edges resolve; shows
  // nothing.
  const locked = await mk({
    displayName: "Withheld", birthYear: 1970,
    privacyTier: "LOCKED", lockedAt: new Date(), addedByUserId: amina.id,
  });

  const rel = (personAId: string, personBId: string, type: string, confirmed = false) =>
    prisma.relationship.create({
      data: { personAId, personBId, type, addedByUserId: amina.id, confirmed },
    });

  // PARENT: personA is the parent of personB.
  await rel(mother.id, aminaP.id, "PARENT", true);
  await rel(father.id, aminaP.id, "PARENT", true);
  await rel(mother.id, brother.id, "PARENT", true);
  await rel(father.id, brother.id, "PARENT", true);
  await rel(grandmother.id, mother.id, "PARENT", true);
  await rel(brother.id, niece.id, "PARENT");
  await rel(mother.id, father.id, "SPOUSE", true);
  await rel(aminaP.id, brother.id, "SIBLING", true);
  await rel(locked.id, father.id, "SIBLING");

  console.log("Seed complete:");
  console.log({
    signIn: "amina@example.com / password123",
    people: 7,
    demonstrates: [
      "PUBLIC (claimed adult, opted in)",
      "FAMILY_ONLY (default for living relatives)",
      "minor — never public/searchable, photo withheld",
      "deceased with unknown birth year — public is allowed",
      "LOCKED — erasure honoured, edges intact",
    ],
  });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
