import { makeStyles } from '@material-ui/core/styles';

// Plain object style
const useButtonStyles = makeStyles({
  root: { padding: '8px 16px' },
  primary: { backgroundColor: '#1976d2', color: '#fff' },
  disabled: { opacity: 0.4 },
});

// Theme function style
const useCardStyles = makeStyles((theme) => ({
  card: { borderRadius: theme.spacing(1) },
  header: { fontWeight: 600 },
  orphanedClass: { display: 'none' },
}));

function Button({ primary, disabled }) {
  const classes = useButtonStyles();
  return (
    <button className={`${classes.root} ${primary ? classes.primary : ''} ${disabled ? classes.disabled : ''}`}>
      Click me
    </button>
  );
}

function Card() {
  const classes = useCardStyles();
  return <div className={classes.card}><h2 className={classes.header}>Title</h2></div>;
  // orphanedClass is never used
}
