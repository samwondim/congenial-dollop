import { Telegraf, Scenes, session } from "telegraf";
import { Composer } from "telegraf";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const BOT_TOKEN = process.env.BOT_TOKEN;

// Helper to generate slug from names
const generateSlug = (name1, name2) => {
  const combined = `${name1}-${name2}`.toLowerCase();
  return combined.replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
};

// Wizard scene for wedding creation
const createWeddingScene = new Scenes.WizardScene(
  "create-wedding",
  // Step 1: Name of first partner
  (ctx) => {
    ctx.reply("💍 Welcome to Wedding Builder! Let's create your wedding site.\n\nFirst, what's the first partner's name? (e.g., Sarah)");
    return ctx.wizard.next();
  },
  // Step 2: Name of second partner
  (ctx) => {
    if (!ctx.message || !ctx.message.text) {
      ctx.reply("Please enter a valid name.");
      return;
    }
    ctx.session.name1 = ctx.message.text.trim();
    ctx.reply(`Great! And the second partner's name? (e.g., James)`);
    return ctx.wizard.next();
  },
  // Step 3: Wedding date
  (ctx) => {
    if (!ctx.message || !ctx.message.text) {
      ctx.reply("Please enter a valid name.");
      return;
    }
    ctx.session.name2 = ctx.message.text.trim();
    ctx.reply(`Perfect! ${ctx.session.name1} & ${ctx.session.name2} 💕\n\nWhat's your wedding date? (format: YYYY-MM-DD, e.g., 2026-09-15)`);
    return ctx.wizard.next();
  },
  // Step 4: Ceremony venue name
  async (ctx) => {
    if (!ctx.message || !ctx.message.text) {
      ctx.reply("Please enter a valid date.");
      return;
    }
    ctx.session.weddingDate = ctx.message.text.trim();
    
    // Create couple in database
    const slug = generateSlug(ctx.session.name1, ctx.session.name2);
    
    const { data, error } = await supabase
      .from("couples")
      .insert({
        slug,
        name1: ctx.session.name1,
        name2: ctx.session.name2,
        wedding_date: ctx.session.weddingDate,
        telegram_chat_id: ctx.message.from.id,
        status: "draft",
      })
      .select()
      .single();
    
    if (error) {
      ctx.reply(`Error creating wedding: ${error.message}`);
      return ctx.scene.leave();
    }
    
    ctx.session.coupleId = data.id;
    ctx.session.slug = slug;
    
    ctx.reply("Almost done! What's the ceremony venue name? (e.g., St. Mary's Cathedral)");
    return ctx.wizard.next();
  },
  // Step 5: Ceremony venue address
  (ctx) => {
    if (!ctx.message || !ctx.message.text) {
      ctx.reply("Please enter a valid venue name.");
      return;
    }
    ctx.session.venueCeremonyName = ctx.message.text.trim();
    ctx.reply("And the ceremony venue address? (e.g., 123 Church Street, San Francisco, CA)");
    return ctx.wizard.next();
  },
  // Step 6: Ceremony time
  (ctx) => {
    if (!ctx.message || !ctx.message.text) {
      ctx.reply("Please enter a valid address.");
      return;
    }
    ctx.session.venueCeremonyAddress = ctx.message.text.trim();
    ctx.reply("What time is the ceremony? (e.g., 2:00 PM)");
    return ctx.wizard.next();
  },
  // Step 7: Reception venue
  async (ctx) => {
    if (!ctx.message || !ctx.message.text) {
      ctx.reply("Please enter a valid time.");
      return;
    }
    ctx.session.venueCeremonyTime = ctx.message.text.trim();
    
    // Update venue info
    await supabase
      .from("couples")
      .update({
        venues: {
          ceremony: {
            name: ctx.session.venueCeremonyName,
            address: ctx.session.venueCeremonyAddress,
            time: ctx.session.venueCeremonyTime,
            city: ctx.session.venueCeremonyAddress,
            description: "Ceremony location",
          },
          reception: {
            name: ctx.session.venueCeremonyName,
            address: ctx.session.venueCeremonyAddress,
            time: ctx.session.venueCeremonyTime,
            city: ctx.session.venueCeremonyAddress,
            description: "Reception location",
          },
        },
      })
      .eq("id", ctx.session.coupleId);
    
    ctx.reply("What's the reception venue name? (e.g., The Grand Ballroom)");
    return ctx.wizard.next();
  },
  // Step 8: Reception venue address
  (ctx) => {
    if (!ctx.message || !ctx.message.text) {
      ctx.reply("Please enter a valid venue name.");
      return;
    }
    ctx.session.venueReceptionName = ctx.message.text.trim();
    ctx.reply("And the reception venue address?");
    return ctx.wizard.next();
  },
  // Step 9: Reception time
  (ctx) => {
    if (!ctx.message || !ctx.message.text) {
      ctx.reply("Please enter a valid address.");
      return;
    }
    ctx.session.venueReceptionAddress = ctx.message.text.trim();
    ctx.reply("What time is the reception? (e.g., 5:00 PM)");
    return ctx.wizard.next();
  },
  // Step 10: Complete and publish
  async (ctx) => {
    if (!ctx.message || !ctx.message.text) {
      ctx.reply("Please enter a valid time.");
      return;
    }
    ctx.session.venueReceptionTime = ctx.message.text.trim();
    
    // Update with reception venue
    await supabase
      .from("couples")
      .update({
        venues: {
          ceremony: {
            name: ctx.session.venueCeremonyName,
            address: ctx.session.venueCeremonyAddress,
            time: ctx.session.venueCeremonyTime,
            city: ctx.session.venueCeremonyAddress,
            description: "Ceremony location",
          },
          reception: {
            name: ctx.session.venueReceptionName,
            address: ctx.session.venueReceptionAddress,
            time: ctx.session.venueReceptionTime,
            city: ctx.session.venueReceptionAddress,
            description: "Reception location",
          },
        },
        status: "published",
      })
      .eq("id", ctx.session.coupleId);
    
    const siteUrl = process.env.SITE_URL || "https://your-wedding-site.com";
    
    ctx.reply(
      `🎉 Congratulations! Your wedding site is ready!\n\n` +
      `View it at: ${siteUrl}/${ctx.session.slug}\n\n` +
      `Want to add more details? Use /edit to modify your site.`
    );
    
    return ctx.scene.leave();
  }
);

// Edit menu scene
const editScene = new Scenes.WizardScene(
  "edit-wedding",
  (ctx) => {
    ctx.reply("What would you like to edit?\n\n" +
      "1. Story / Love Timeline\n" +
      "2. Schedule\n" +
      "3. Venues\n" +
      "4. Photos\n" +
      "5. FAQ\n" +
      "6. Registry\n\n" +
      "Type the number of your choice."
    );
    return ctx.wizard.next();
  }
);

const stage = new Scenes.Stage([createWeddingScene, editScene]);

const bot = new Telegraf(BOT_TOKEN);

bot.use(session());
bot.use(stage.middleware());

bot.start((ctx) => {
  ctx.reply(
    "💍 Welcome to Wedding Builder!\n\n" +
    "I help you create a beautiful wedding website.\n\n" +
    "Commands:\n" +
    "/start - Create a new wedding site\n" +
    "/edit - Edit your existing wedding\n" +
    "/help - Get help"
  );
});

bot.command("start", (ctx) => {
  ctx.scene.enter("create-wedding");
});

bot.command("edit", async (ctx) => {
  const chatId = ctx.message.from.id;
  
  const { data: couple } = await supabase
    .from("couples")
    .select("*")
    .eq("telegram_chat_id", chatId)
    .single();
  
  if (!couple) {
    ctx.reply("You don't have a wedding site yet. Use /start to create one!");
    return;
  }
  
  ctx.session.coupleId = couple.id;
  ctx.session.slug = couple.slug;
  ctx.session.name1 = couple.name1;
  ctx.session.name2 = couple.name2;
  
  ctx.scene.enter("edit-wedding");
});

bot.command("help", (ctx) => {
  ctx.reply(
    "Need help? Here's how to use Wedding Builder:\n\n" +
    "1. Run /start to create a new wedding site\n" +
    "2. Follow the prompts to enter your details\n" +
    "3. Your site will be created and published automatically\n" +
    "4. Use /edit to make changes later\n\n" +
    "Questions? Contact support."
  );
});

// Handle photo uploads
bot.on("photo", async (ctx) => {
  const chatId = ctx.message.from.id;
  
  const { data: couple } = await supabase
    .from("couples")
    .select("*")
    .eq("telegram_chat_id", chatId)
    .single();
  
  if (!couple) {
    ctx.reply("You don't have a wedding site yet. Use /start to create one!");
    return;
  }
  
  // Get the photo
  const photo = ctx.message.photo[ctx.message.photo.length - 1];
  const file = await ctx.telegram.getFile(photo.file_id);
  
  // Download and upload to Supabase Storage
  const response = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  const fileName = `${couple.slug}/${Date.now()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from("wedding-photos")
    .upload(fileName, buffer);
  
  if (uploadError) {
    ctx.reply(`Error uploading photo: ${uploadError.message}`);
    return;
  }
  
  const { data: urlData } = supabase.storage
    .from("wedding-photos")
    .getPublicUrl(fileName);
  
  // Add to photos
  const newPhotos = [
    ...couple.photos,
    {
      id: Date.now(),
      src: urlData.publicUrl,
      alt: "Wedding photo",
      category: "couple",
    }
  ];
  
  await supabase
    .from("couples")
    .update({ photos: newPhotos })
    .eq("id", couple.id);
  
  ctx.reply("Photo added! View your site to see it.");
});

// Error handler
bot.catch((err, ctx) => {
  console.error("Bot error:", err);
  ctx.reply("Something went wrong. Please try again or use /start.");
});

// Webhook handler for Vercel
export default function handler(req, res) {
  if (req.method === "POST") {
    bot.handleUpdate(req.body, res);
  } else {
    res.status(200).send("OK");
  }
}
