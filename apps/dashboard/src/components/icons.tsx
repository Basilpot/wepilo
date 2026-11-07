/**
 * The dashboard's single icon source. UI glyphs come from the Pikaicons free set,
 * exposed under the names the code already used, so call sites stay readable.
 * The free set has no text-formatting, spinner, grip or plain-tick glyphs; those few
 * fall back to Lucide at the bottom of this file and nowhere else.
 */
import { forwardRef, type SVGProps } from "react";
import { PikaIcon, type IconSvgElement } from "@pikaicons/react";
import * as P from "@pikaicons/core-free";
import * as Lu from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import * as HI from "@hugeicons/core-free-icons";

export type IconProps = Omit<SVGProps<SVGSVGElement>, "ref" | "children"> & {
  size?: number | string;
  strokeWidth?: number | string;
};
export type IconComponent = React.ForwardRefExoticComponent<IconProps & React.RefAttributes<SVGSVGElement>>;
/** Kept so existing `type LucideIcon` imports keep compiling. */
export type LucideIcon = IconComponent;

function pika(icon: IconSvgElement, name: string): IconComponent {
  const C = forwardRef<SVGSVGElement, IconProps>(({ strokeWidth = 1.75, ...props }, ref) => (
    <PikaIcon ref={ref} icon={icon} strokeWidth={strokeWidth} aria-hidden={props["aria-label"] ? undefined : true} {...props} />
  ));
  C.displayName = name;
  return C;
}

function hug(icon: (typeof HI)[keyof typeof HI], name: string): IconComponent {
  const C = forwardRef<SVGSVGElement, IconProps>(({ strokeWidth = 1.75, size = 16, ...props }, ref) => (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <HugeiconsIcon ref={ref as any} icon={icon as any} size={size} strokeWidth={strokeWidth} aria-hidden={props["aria-label"] ? undefined : true} {...(props as any)} />
  ));
  C.displayName = name;
  return C;
}

// Navigation & objects
export const GaugeCircle = Lu.GaugeCircle as IconComponent;
export const Inbox = hug(HI.InboxIcon, "Inbox");
export const Receipt = hug(HI.ReceiptIcon, "Receipt");
export const Footprints = hug(HI.FootprintsIcon, "Footprints");
export const Mountain = hug(HI.MountainIcon, "Mountain");
export const CalendarCheck = hug(HI.CalendarCheck01Icon, "CalendarCheck");
export const CalendarDays = hug(HI.CalendarDaysIcon, "CalendarDays");
export const Package = hug(HI.Package01Icon, "Package");
export const PackageOpen = hug(HI.PackageOpenIcon, "PackageOpen");
export const MapPinHouse = hug(HI.MapPinHouseIcon, "MapPinHouse");
export const MapPinCheck = hug(HI.MapPinCheckIcon, "MapPinCheck");
export const Layers2 = Lu.Layers2 as IconComponent;
export const Tag = hug(HI.Tag01Icon, "Tag");
export const NotebookPen = hug(HI.NotebookPenIcon, "NotebookPen");
export const Newspaper = hug(HI.NewspaperIcon, "Newspaper");
export const CopyX = hug(HI.CopyXIcon, "CopyX");
export const FolderTree = hug(HI.FolderTreeIcon, "FolderTree");
export const Image = hug(HI.Image01Icon, "Image");
export const ImageIcon = Image;
export const Images = Image;
export const ImagePlus = hug(HI.ImagePlusIcon, "ImagePlus");
export const Library = hug(HI.LibraryIcon, "Library");
export const Redo = hug(HI.Redo01Icon, "Redo");
export const Contact2 = Lu.Contact2 as IconComponent;
export const Building2 = Lu.Building2 as IconComponent;
export const PenLine = hug(HI.PenLineIcon, "PenLine");
export const Pencil = PenLine;
export const Quote = hug(HI.QuoteIcon, "Quote");
export const Star = hug(HI.StarIcon, "Star");
export const StarOff = Star;
export const FileText = hug(HI.FileTextIcon, "FileText");
export const FilePlus2 = Lu.FilePlus2 as IconComponent;
export const Mail = hug(HI.Mail01Icon, "Mail");
export const MailCheck = Mail;
export const MailX = hug(HI.MailXIcon, "MailX");
export const Settings = hug(HI.Settings01Icon, "Settings");
export const Users2 = Lu.Users2 as IconComponent;
export const UserPlus = hug(HI.UserPlusIcon, "UserPlus");
export const UserCheck = hug(HI.UserCheck01Icon, "UserCheck");
export const UserX = hug(HI.UserXIcon, "UserX");
export const KeyRound = hug(HI.KeyRoundIcon, "KeyRound");
export const CreditCard = hug(HI.CreditCardIcon, "CreditCard");
export const LifeBuoy = Lu.LifeBuoy as IconComponent;
export const Globe = hug(HI.GlobeIcon, "Globe");
export const ShieldCheck = hug(HI.ShieldCheckIcon, "ShieldCheck");
export const Code = hug(HI.CodeIcon, "Code");
export const Clock = hug(HI.Clock01Icon, "Clock");
export const Phone = hug(HI.PhoneIcon, "Phone");
export const MessageCircle = hug(HI.MessageCircleIcon, "MessageCircle");
export const Moon = hug(HI.Moon01Icon, "Moon");
export const Sun = hug(HI.Sun01Icon, "Sun");

// Actions
export const Plus = hug(HI.PlusIcon, "Plus");
export const Search = hug(HI.Search01Icon, "Search");
export const SearchIcon = Search;
export const SearchX = Search;
export const Upload = hug(HI.Upload01Icon, "Upload");
export const Save = hug(HI.SaveIcon, "Save");
export const Send = hug(HI.SendIcon, "Send");
export const Copy = hug(HI.Copy01Icon, "Copy");
export const Trash2 = Lu.Trash2 as IconComponent;
export const ExternalLink = hug(HI.ExternalLinkIcon, "ExternalLink");
export const Link2 = Lu.Link2 as IconComponent;
export const LogOut = hug(HI.LogOutIcon, "LogOut");
export const Eye = Lu.Eye as IconComponent;
export const EyeOff = hug(HI.EyeOffIcon, "EyeOff");
export const RefreshCw = hug(HI.RefreshCwIcon, "RefreshCw");
export const RotateCcw = RefreshCw;
export const Power = hug(HI.PowerIcon, "Power");
export const MoreHorizontal = hug(HI.MoreHorizontalIcon, "MoreHorizontal");
export const PanelLeftIcon = hug(HI.PanelLeftIcon, "PanelLeftIcon");

// Direction
export const ArrowDown = hug(HI.ArrowDown01Icon, "ArrowDown");
export const ArrowUp = hug(HI.ArrowUp01Icon, "ArrowUp");
export const ArrowLeft = hug(HI.ArrowLeft01Icon, "ArrowLeft");
export const ArrowRight = hug(HI.ArrowRight01Icon, "ArrowRight");
export const ChevronDown = hug(HI.ChevronDownIcon, "ChevronDown");
export const ChevronDownIcon = ChevronDown;
export const ChevronUpIcon = hug(HI.ChevronUpIcon, "ChevronUpIcon");
export const ChevronLeft = hug(HI.ChevronLeftIcon, "ChevronLeft");
export const ChevronRight = hug(HI.ChevronRightIcon, "ChevronRight");
export const ChevronRightIcon = ChevronRight;

// Status
export const CheckCircle2 = Lu.CheckCircle2 as IconComponent;
export const CircleCheckBig = CheckCircle2;
export const CircleCheckIcon = CheckCircle2;
export const CircleAlert = Lu.CircleAlert as IconComponent;
export const HelpCircle = hug(HI.CircleQuestionMarkIcon, "HelpCircle");
export const Info = hug(HI.InfoIcon, "Info");
export const InfoIcon = Info;
export const TriangleAlert = hug(HI.TriangleAlertIcon, "TriangleAlert");
export const TriangleAlertIcon = TriangleAlert;
export const OctagonXIcon = hug(HI.OctagonXIcon, "OctagonXIcon");
export const XCircle = OctagonXIcon;
export const X = hug(HI.XIcon, "X");
export const XIcon = X;

// Glyphs the free Pikaicons set does not draw.
export {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  CheckIcon,
  ChevronsUpDown,
  CircleIcon,
  GripVertical,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  LayoutTemplate,
  Paperclip,
  List,
  ListOrdered,
  Loader2,
  Loader2Icon,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react";
export { Quote as QuoteGlyph } from "lucide-react";
