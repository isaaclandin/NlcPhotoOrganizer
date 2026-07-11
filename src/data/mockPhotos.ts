import type { LucideIcon } from "lucide-react";
import {
  Shirt,
  Package,
  Users,
  BookOpen,
  Building2,
  ChefHat,
  Dog,
  Tag as TagIcon,
  PartyPopper,
  Sunrise,
  Sofa,
  Flower2,
  Library,
  Truck,
  BookHeart,
  Landmark,
  HeartHandshake,
  PenLine,
  UsersRound,
  NotebookPen,
  Bug,
  Volleyball,
  Shirt as ShirtIcon,
  Sunset,
} from "lucide-react";

import clothingRack from "../assets/photos/clothing_rack.jpg";
import donationBoxes from "../assets/photos/donation_boxes.jpg";
import strongerTogether from "../assets/photos/stronger_together.jpg";
import readingRoom from "../assets/photos/reading_room.jpg";
import nlcBuilding from "../assets/photos/nlc_building.jpg";
import kitchenVolunteers from "../assets/photos/kitchen_volunteers.jpg";
import dogAdoption from "../assets/photos/dog_adoption.jpg";
import clothingDriveToday from "../assets/photos/clothing_drive_today.jpg";
import communityEvent from "../assets/photos/community_event.jpg";
import nlcPortrait from "../assets/photos/nlc_portrait.jpg";
import livingRoom from "../assets/photos/living_room.jpg";
import wildflowers from "../assets/photos/wildflowers.jpg";
import bookStack from "../assets/photos/book_stack.jpg";
import deliveryVan from "../assets/photos/delivery_van.jpg";
import storyTime from "../assets/photos/story_time.jpg";
import communityShelter from "../assets/photos/community_shelter.jpg";
import warmHug from "../assets/photos/warm_hug.jpg";
import thankYouGiving from "../assets/photos/thank_you_giving.jpg";
import teamPhoto from "../assets/photos/team_photo.jpg";
import journalNotes from "../assets/photos/journal_notes.jpg";
import butterflyGarden from "../assets/photos/butterfly_garden.jpg";
import basketballCourt from "../assets/photos/basketball_court.jpg";
import foldedDonations from "../assets/photos/folded_donations.jpg";
import goldenSunset from "../assets/photos/golden_sunset.jpg";

export interface MockPhoto {
  id: string;
  filename: string;
  label: string;
  icon: LucideIcon;
  image: string;
  selected?: boolean;
}

export const mockPhotos: MockPhoto[] = [
  { id: "p1", filename: "IMG_4381.jpg", label: "Clothing Rack", icon: Shirt, image: clothingRack },
  { id: "p2", filename: "IMG_4382.jpg", label: "Donation Boxes", icon: Package, image: donationBoxes },
  { id: "p3", filename: "IMG_4383.jpg", label: "Stronger Together", icon: Users, image: strongerTogether },
  { id: "p4", filename: "IMG_4384.jpg", label: "Reading Room", icon: BookOpen, image: readingRoom, selected: true },
  { id: "p5", filename: "IMG_4385.jpg", label: "NLC Building", icon: Building2, image: nlcBuilding },
  { id: "p6", filename: "IMG_4386.jpg", label: "Kitchen Volunteers", icon: ChefHat, image: kitchenVolunteers },
  { id: "p7", filename: "IMG_4387.jpg", label: "Dog Adoption", icon: Dog, image: dogAdoption, selected: true },
  { id: "p8", filename: "IMG_4388.jpg", label: "Clothing Drive Today", icon: ShirtIcon, image: clothingDriveToday },
  { id: "p9", filename: "IMG_4389.jpg", label: "Community Event", icon: PartyPopper, image: communityEvent },
  { id: "p10", filename: "IMG_4390.jpg", label: "NLC Portrait", icon: Sunrise, image: nlcPortrait, selected: true },
  { id: "p11", filename: "IMG_4391.jpg", label: "Living Room", icon: Sofa, image: livingRoom },
  { id: "p12", filename: "IMG_4392.jpg", label: "Wildflowers", icon: Flower2, image: wildflowers },
  { id: "p13", filename: "IMG_4393.jpg", label: "Book Stack", icon: Library, image: bookStack },
  { id: "p14", filename: "IMG_4394.jpg", label: "Delivery Van", icon: Truck, image: deliveryVan },
  { id: "p15", filename: "IMG_4395.jpg", label: "Story Time", icon: BookHeart, image: storyTime },
  { id: "p16", filename: "IMG_4396.jpg", label: "Community Shelter", icon: Landmark, image: communityShelter },
  { id: "p17", filename: "IMG_4397.jpg", label: "Warm Hug", icon: HeartHandshake, image: warmHug, selected: true },
  { id: "p18", filename: "IMG_4398.jpg", label: "Thank You For Giving", icon: TagIcon, image: thankYouGiving },
  { id: "p19", filename: "IMG_4399.jpg", label: "Team Photo", icon: UsersRound, image: teamPhoto },
  { id: "p20", filename: "IMG_4400.jpg", label: "Journal Notes", icon: NotebookPen, image: journalNotes },
  { id: "p21", filename: "IMG_4401.jpg", label: "Butterfly Garden", icon: Bug, image: butterflyGarden },
  { id: "p22", filename: "IMG_4402.jpg", label: "Basketball Court", icon: Volleyball, image: basketballCourt },
  { id: "p23", filename: "IMG_4403.jpg", label: "Folded Donations", icon: PenLine, image: foldedDonations },
  { id: "p24", filename: "IMG_4404.jpg", label: "Golden Sunset", icon: Sunset, image: goldenSunset },
];
