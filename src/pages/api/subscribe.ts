import type { APIRoute } from "astro";
import { Resend } from "resend";

export const prerender = false;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: APIRoute = async ({ request }) => {
	let payload: unknown;

	try {
		payload = await request.json();
	} catch {
		return Response.json({ message: "Invalid request." }, { status: 400 });
	}

	if (!payload || typeof payload !== "object") {
		return Response.json({ message: "Invalid request." }, { status: 400 });
	}

	const { email, website } = payload as Record<string, unknown>;

	// Honeypot submissions get a fake success response.
	if (typeof website === "string" && website.length > 0) {
		return Response.json({ message: "You're on the list." });
	}

	if (
		typeof email !== "string" ||
		email.length > 254 ||
		!emailPattern.test(email)
	) {
		return Response.json(
			{ message: "Enter a valid email address." },
			{ status: 400 },
		);
	}

	const apiKey = import.meta.env.RESEND_API_KEY;
	const segmentId = import.meta.env.RESEND_SEGMENT_ID;

	if (!apiKey || !segmentId) {
		console.error("Resend environment variables are not configured.");
		return Response.json(
			{ message: "Signup is temporarily unavailable." },
			{ status: 503 },
		);
	}

	const normalizedEmail = email.trim().toLowerCase();
	const resend = new Resend(apiKey);
	const { error: createError } = await resend.contacts.create({
		email: normalizedEmail,
		unsubscribed: false,
		segments: [{ id: segmentId }],
	});

	if (createError?.statusCode === 409) {
		const [contactResult, segmentsResult] = await Promise.all([
			resend.contacts.get({ email: normalizedEmail }),
			resend.contacts.segments.list({ email: normalizedEmail }),
		]);

		if (contactResult.error || segmentsResult.error) {
			console.error(
				"Resend subscription lookup failed:",
				contactResult.error || segmentsResult.error,
			);
			return Response.json(
				{ message: "Could not add your email. Try again." },
				{ status: 502 },
			);
		}

		const isInSegment = segmentsResult.data.data.some(
			(segment) => segment.id === segmentId,
		);

		if (isInSegment && !contactResult.data.unsubscribed) {
			return Response.json({ message: "Thanks — you're on the list." });
		}

		const { error: updateError } = await resend.contacts.update({
			email: normalizedEmail,
			unsubscribed: false,
		});

		if (updateError) {
			console.error("Resend contact resubscription failed:", updateError);
			return Response.json(
				{ message: "Could not add your email. Try again." },
				{ status: 502 },
			);
		}

		if (!isInSegment) {
			const { error: segmentError } = await resend.contacts.segments.add({
				email: normalizedEmail,
				segmentId,
			});

			if (segmentError && segmentError.statusCode !== 409) {
				console.error("Resend segment subscription failed:", segmentError);
				return Response.json(
					{ message: "Could not add your email. Try again." },
					{ status: 502 },
				);
			}
		}

		return Response.json({ message: "Thanks — you're on the list." });
	}

	if (createError) {
		console.error("Resend contact subscription failed:", createError);
		return Response.json(
			{ message: "Could not add your email. Try again." },
			{ status: 502 },
		);
	}

	return Response.json({ message: "Thanks — you're on the list." });
};
